import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import redis from "@/lib/redis";
import KEYS from "@/lib/redis-keys";

type WorkerCommand = "pause" | "resume" | "drain" | "disable" | "resign_leader";
type RunCommand = "start_run" | "pause_run" | "resume_run" | "retry_failed" | "rebuild_output" | "cancel_run";

type CommandPayload =
  | { type: "worker"; command: WorkerCommand; nodeId: string; runId: string }
  | { type: "run"; command: RunCommand; runId: string };

// ─── Validación ──────────────────────────────────────────────────────────────

const VALID_WORKER_COMMANDS: WorkerCommand[] = ["pause", "resume", "drain", "disable", "resign_leader"];
const VALID_RUN_COMMANDS: RunCommand[] = [
  "start_run",
  "pause_run",
  "resume_run",
  "retry_failed",
  "rebuild_output",
  "cancel_run",
];

function validatePayload(body: unknown): CommandPayload | null {
  if (!body || typeof body !== "object") return null;

  const b = body as Record<string, unknown>;

  if (b.type === "worker") {
    if (
      typeof b.nodeId !== "string" ||
      typeof b.runId !== "string" ||
      !VALID_WORKER_COMMANDS.includes(b.command as WorkerCommand)
    ) {
      return null;
    }
    return {
      type: "worker",
      command: b.command as WorkerCommand,
      nodeId: b.nodeId,
      runId: b.runId,
    };
  }

  if (b.type === "run") {
    if (
      typeof b.runId !== "string" ||
      !VALID_RUN_COMMANDS.includes(b.command as RunCommand)
    ) {
      return null;
    }
    return {
      type: "run",
      command: b.command as RunCommand,
      runId: b.runId,
    };
  }

  return null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const payload = validatePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: "Comando o parámetros inválidos" },
      { status: 400 }
    );
  }

  const commandId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    await redis.ping();
  } catch {
    // Redis no disponible → devolver OK de todas formas (modo mock)
    return NextResponse.json({
      commandId,
      status: "queued_mock",
      message: "Redis no disponible, comando simulado",
    });
  }

  const streamKey = KEYS.commandsStream(payload.runId);
  const fields: string[] = [
    "commandId", commandId,
    "type", payload.type,
    "command", payload.command,
    "runId", payload.runId,
    "timestamp", timestamp,
  ];

  if (payload.type === "worker") {
    fields.push("nodeId", payload.nodeId);
  }

  // Publicar comando en el stream de Redis
  const messageId = await redis.xadd(streamKey, "*", ...fields);

  // Agregar evento al stream de eventos para que aparezca en el dashboard
  await redis.xadd(
    KEYS.eventsStream(payload.runId),
    "*",
    "timestamp", timestamp,
    "severity", "info",
    "eventType", `command_${payload.command}`,
    ...(payload.type === "worker" ? ["nodeId", payload.nodeId] : []),
    "message",
    payload.type === "worker"
      ? `Comando '${payload.command}' enviado a nodo ${payload.nodeId}`
      : `Comando '${payload.command}' enviado al run ${payload.runId}`
  );

  // Mantener el stream de eventos acotado (máx 200 entradas)
  await redis.xtrim(KEYS.eventsStream(payload.runId), "MAXLEN", "~", 200);

  // ── Acción inmediata para start_run: resetear el run en Redis ───────────────
  if (payload.type === "run" && payload.command === "start_run") {
    const { runId } = payload;

    // 1. Resetear TODOS los chunks del run a PENDING
    const chunkKeys = await redis.keys(`chunk:${runId}:*`);
    if (chunkKeys.length > 0) {
      const pipeline = redis.pipeline();
      for (const key of chunkKeys) {
        pipeline.hset(key,
          "status", "PENDING",
          "workerId", "",
          "attempts", "0",
        );
      }
      await pipeline.exec();
    }

    // 2. Limpiar el SET de chunks completados (usado por SCARD en el snapshot)
    await redis.del(`runs:${runId}:chunks:done`);

    // 3. Resetear el STRING de status (tiene prioridad sobre el HASH en el snapshot)
    await redis.set(`runs:${runId}:status`, "IDLE");

    // 4. Resetear stats HASH del run
    await redis.hset(KEYS.runStats(runId),
      "status", "IDLE",
      "completedChunks", "0",
      "processingChunks", "0",
      "failedChunks", "0",
      "retryingChunks", "0",
      "pendingChunks", String(chunkKeys.length),
    );

    // 5. Registrar evento
    await redis.xadd(
      KEYS.eventsStream(runId), "*",
      "timestamp", timestamp,
      "severity", "info",
      "eventType", "run_reset",
      "message", `Run ${runId} reseteado a IDLE — ${chunkKeys.length} chunks listos para procesar`
    );

    console.log(`[api/worker/command] Run ${runId} reseteado: ${chunkKeys.length} chunks → PENDING, status → IDLE`);
  }

  // ── Acciones inmediatas para disable / resign_leader ──────────────────────
  if (
    payload.type === "worker" &&
    (payload.command === "disable" || payload.command === "resign_leader")
  ) {
    const { nodeId, runId } = payload;

    // 1. Marcar el nodo como DISABLED en su heartbeat (efecto inmediato en UI)
    const nodeRaw = await redis.get(KEYS.node(nodeId));
    if (nodeRaw) {
      try {
        const nodeJson = JSON.parse(nodeRaw) as Record<string, unknown>;
        nodeJson.status = "DISABLED";
        await redis.setex(KEYS.node(nodeId), 30, JSON.stringify(nodeJson));
      } catch { /* ignorar si el JSON es inválido */ }
    }

    // 2. Sacar del set de nodos activos
    await redis.srem(KEYS.nodesActive, nodeId);

    // 3. Resetear chunks PROCESSING de este nodo → PENDING (redistribuye carga)
    const chunkKeys = await redis.keys(`chunk:${runId}:*`);
    if (chunkKeys.length > 0) {
      const pipeline = redis.pipeline();
      for (const key of chunkKeys) {
        // Necesitamos leer y filtrar; hacemos hgetall individual (son pocos chunks)
        pipeline.hgetall(key);
      }
      const results = await pipeline.exec();
      const resetPipeline = redis.pipeline();
      let resetCount = 0;
      results?.forEach((res, i) => {
        const data = res?.[1] as Record<string, string> | null;
        if (!data) return;
        const worker = data.workerId ?? data.worker_id ?? "";
        const status = data.status ?? "";
        if (worker === nodeId && status === "PROCESSING") {
          resetPipeline.hset(chunkKeys[i], "status", "PENDING", "workerId", "");
          resetCount++;
        }
      });
      if (resetCount > 0) {
        await resetPipeline.exec();
        // Actualizar stats del run: restar processingChunks, sumar pendingChunks
        await redis.hincrby(KEYS.runStats(runId), "processingChunks", -resetCount);
        await redis.hincrby(KEYS.runStats(runId), "pendingChunks", resetCount);
        await redis.xadd(
          KEYS.eventsStream(runId), "*",
          "timestamp", new Date().toISOString(),
          "severity", "warning",
          "eventType", "chunks_redistributed",
          "nodeId", nodeId,
          "message", `${resetCount} chunk(s) de ${nodeId} reseteados a PENDING para redistribución`
        );
      }
    }

    // 4. Si este nodo es el líder actual → borrar el lock (fuerza reelección)
    const leaderRaw = await redis.get(KEYS.leaderLock);
    if (leaderRaw) {
      try {
        const leader = JSON.parse(leaderRaw) as Record<string, unknown>;
        const leaderId = (leader.nodeId ?? leader.node_id) as string | undefined;
        if (leaderId === nodeId) {
          await redis.del(KEYS.leaderLock);
          await redis.xadd(
            KEYS.eventsStream(runId), "*",
            "timestamp", new Date().toISOString(),
            "severity", "warning",
            "eventType", "leader_resigned",
            "nodeId", nodeId,
            "message", `Líder ${nodeId} deshabilitado — lock eliminado, reelección en curso`
          );
        }
      } catch { /* ignorar */ }
    }
  }

  console.log(
    `[api/worker/command] Comando publicado: ${payload.command} → messageId=${messageId}`
  );

  return NextResponse.json({ commandId, status: "queued", messageId });
}
