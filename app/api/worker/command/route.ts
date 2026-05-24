import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import redis from "@/lib/redis";
import KEYS from "@/lib/redis-keys";

type WorkerCommand = "pause" | "resume" | "drain" | "disable";
type RunCommand = "start_run" | "pause_run" | "resume_run" | "retry_failed" | "rebuild_output" | "cancel_run";

type CommandPayload =
  | { type: "worker"; command: WorkerCommand; nodeId: string; runId: string }
  | { type: "run"; command: RunCommand; runId: string };

// ─── Validación ──────────────────────────────────────────────────────────────

const VALID_WORKER_COMMANDS: WorkerCommand[] = ["pause", "resume", "drain", "disable"];
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

  console.log(
    `[api/worker/command] Comando publicado: ${payload.command} → messageId=${messageId}`
  );

  return NextResponse.json({ commandId, status: "queued", messageId });
}
