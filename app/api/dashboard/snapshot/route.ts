import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import redis from "@/lib/redis";
import KEYS from "@/lib/redis-keys";
import type {
  ChunkInfo,
  ClusterEvent,
  DashboardSnapshot,
  RunStatus,
  WorkerNode,
  WorkerRole,
  WorkerStatus,
} from "@/features/dashboard/types";
import { mockDashboardSnapshot } from "@/features/dashboard/mockData";

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeParseInt(v: unknown, fallback = 0): number {
  const n = parseInt(String(v ?? ""), 10);
  return isNaN(n) ? fallback : n;
}

function safeParseFloat(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? ""));
  return isNaN(n) ? fallback : n;
}

// ─── Leer snapshot desde Redis ───────────────────────────────────────────────

async function readSnapshotFromRedis(
  runId: string
): Promise<DashboardSnapshot | null> {
  // ── 1. Verificar que Redis responde ────────────────────────────────────────
  try {
    await redis.ping();
  } catch {
    return null;
  }

  // ── 2. Estado del run ──────────────────────────────────────────────────────
  // El backend escribe el status en dos sitios:
  //   runs:{runId}:status  → STRING con el estado actual (IDLE/RUNNING/COMPLETED...)
  //   runs:{runId}:stats   → HASH con métricas agregadas
  //   runs:{runId}:meta    → HASH con metadata del run (comparable_size, total_chunks, etc.)
  const [runStatusRaw, runStats, runMeta] = await Promise.all([
    redis.get(`runs:${runId}:status`),
    redis.hgetall(KEYS.runStats(runId)),
    redis.hgetall(`runs:${runId}:meta`),
  ]);

  // Si no hay ni status ni stats → el run aún no arrancó
  if (!runStatusRaw && (!runStats || Object.keys(runStats).length === 0)) {
    return null;
  }

  const stats = runStats ?? {};
  const meta = runMeta ?? {};
  const totalChunks = safeParseInt(stats.totalChunks ?? meta.total_chunks, 0);
  const processingChunks = safeParseInt(stats.processingChunks, 0);
  const failedChunks = safeParseInt(stats.failedChunks, 0);
  const retryingChunks = safeParseInt(stats.retryingChunks, 0);
  // comparable_size del meta es el número de bases (bytes) comparables
  const totalBases = safeParseInt(stats.totalBases, 0) || safeParseInt(meta.comparable_size, 0);
  const matches = safeParseInt(stats.matches, 0);
  const mismatches = safeParseInt(stats.mismatches, 0);

  // completedChunks: preferir SCARD del SET que el backend mantiene
  const completedFromSet = await redis.scard(`runs:${runId}:chunks:done`);
  const completedChunks = completedFromSet > 0
    ? completedFromSet
    : safeParseInt(stats.completedChunks, 0);
  const pendingChunks = safeParseInt(
    stats.pendingChunks,
    Math.max(0, totalChunks - completedChunks - processingChunks - failedChunks - retryingChunks)
  );

  // Estado: STRING separado tiene prioridad sobre el campo del HASH
  const runStatus = (runStatusRaw ?? stats.status ?? "IDLE") as RunStatus;

  const run = {
    runId,
    status: runStatus,
    totalBases,
    totalChunks,
    completedChunks,
    pendingChunks,
    processingChunks,
    failedChunks,
    retryingChunks,
    progressPercentage:
      totalChunks > 0 ? (completedChunks / totalChunks) * 100 : 0,
    matches,
    mismatches,
    similarityPercentage:
      totalBases > 0
        ? safeParseFloat(stats.similarityPercentage, (matches / totalBases) * 100)
        : null,
    startedAt: stats.startedAt ?? null,
    finishedAt: stats.finishedAt ?? null,
  };

  // ── 3. Líder actual ────────────────────────────────────────────────────────
  const leaderRaw = await redis.get(KEYS.leaderLock);
  let leaderNodeId: string | null = null;
  let leaderEpoch: number | null = null;

  if (leaderRaw) {
    try {
      const parsed = JSON.parse(leaderRaw);
      // El backend escribe node_id (snake_case); soportar ambas variantes
      leaderNodeId = parsed.node_id ?? parsed.nodeId ?? null;
      leaderEpoch = parsed.epoch ?? null;
    } catch {
      // Lock malformado, ignorar
    }
  }

  // ── 4. Workers (desde heartbeats) ─────────────────────────────────────────
  const activeNodeIds = await redis.smembers(KEYS.nodesActive);
  const workers: WorkerNode[] = [];
  const now = Date.now();

  for (const nodeId of activeNodeIds) {
    const raw = await redis.get(KEYS.node(nodeId));
    if (!raw) {
      // TTL expiró → nodo muerto, limpiar set
      await redis.srem(KEYS.nodesActive, nodeId);
      continue;
    }

    try {
      const data = JSON.parse(raw);
      const heartbeatAgeSeconds = Math.floor(
        (now - safeParseInt(data.timestamp, now)) / 1000
      );

      const role: WorkerRole =
        nodeId === leaderNodeId ? "LEADER" : "WORKER";

      workers.push({
        nodeId,
        role,
        status: (data.status ?? "ACTIVE") as WorkerStatus,
        priority: safeParseInt(data.priority, 50),
        canBeLeader: data.canBeLeader === true || data.canBeLeader === "true",
        heartbeatAgeSeconds,
        // El backend puede enviar cpu_usage, cpuUsage o cpu
        cpuUsagePercent: safeParseInt(data.cpuUsage ?? data.cpu_usage ?? data.cpu, 0),
        memoryUsagePercent: safeParseInt(data.memoryUsage ?? data.memory_usage ?? data.memory, 0),
        concurrency: safeParseInt(data.concurrency, 1),
        activeJobs: safeParseInt(data.activeJobs ?? data.active_jobs, 0),
        completedJobs: safeParseInt(data.completedJobs ?? data.completed_jobs, 0),
        failedJobs: safeParseInt(data.failedJobs ?? data.failed_jobs, 0),
        currentChunkId: data.currentChunkId ?? data.current_chunk ?? null,
        provider: (data.provider ?? "LOCAL").toUpperCase(),
      });
    } catch {
      // Heartbeat malformado, saltar
    }
  }

  // Ordenar: líder primero
  workers.sort((a, b) => (a.role === "LEADER" ? -1 : b.role === "LEADER" ? 1 : 0));

  // ── 5. Salud del cluster ───────────────────────────────────────────────────
  const aliveNodes = workers.filter(
    (w) => w.status !== "DEAD" && w.status !== "DISABLED"
  ).length;

  const health =
    aliveNodes === 0
      ? "CRITICAL"
      : failedChunks > 5 || aliveNodes < workers.length / 2
      ? "DEGRADED"
      : "HEALTHY";

  // ── 6. Chunks ──────────────────────────────────────────────────────────────
  const chunkPattern = `chunk:${runId}:*`;
  const chunkKeys = await redis.keys(chunkPattern);
  const chunks: ChunkInfo[] = [];

  // Leer hasta 100 chunks para no sobrecargar
  for (const key of chunkKeys.slice(0, 100)) {
    const data = await redis.hgetall(key);
    if (!data) continue;

    const chunkId = key.split(":").pop() ?? key;
    chunks.push({
      chunkId,
      chunkIndex: safeParseInt(data.chunkIndex ?? data.chunk_index, 0),
      start: safeParseInt(data.start, 0),
      end: safeParseInt(data.end, 0),
      status: (data.status ?? "PENDING") as ChunkInfo["status"],
      // El backend escribe el campo como 'worker' (no 'workerId')
      workerId: data.workerId ?? data.worker ?? null,
      matches: data.matches ? safeParseInt(data.matches) : null,
      mismatches: data.mismatches ? safeParseInt(data.mismatches) : null,
      attempts: safeParseInt(data.attempts ?? data.retries, 1),
      checksum: data.checksum ?? null,
      updatedAt: data.updatedAt ?? data.updated_at ?? new Date().toISOString(),
    });
  }

  // Ordenar por índice
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

  // ── 7. Eventos recientes (desde stream) ────────────────────────────────────
  const events: ClusterEvent[] = [];
  try {
    const streamEntries = await redis.xrevrange(
      KEYS.eventsStream(runId),
      "+",
      "-",
      "COUNT",
      20
    );

    for (const [id, fields] of streamEntries) {
      // fields es un array plano: [key1, val1, key2, val2, ...]
      const fieldMap: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        fieldMap[fields[i]] = fields[i + 1];
      }

      events.push({
        id,
        timestamp: fieldMap.timestamp ?? new Date().toISOString(),
        severity: (fieldMap.severity ?? "info") as ClusterEvent["severity"],
        eventType: fieldMap.eventType ?? "unknown",
        nodeId: fieldMap.nodeId ?? undefined,
        chunkId: fieldMap.chunkId ?? undefined,
        message: fieldMap.message ?? "",
      });
    }
  } catch {
    // Stream no existe aún, continuar sin eventos
  }

  return {
    run,
    cluster: {
      leaderNodeId,
      leaderEpoch,
      redisConnected: true,
      aliveNodes,
      totalNodes: workers.length,
      health,
      lastUpdatedAt: new Date().toISOString(),
    },
    workers,
    chunks,
    events,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId") ?? "run-001";

  try {
    const snapshot = await readSnapshotFromRedis(runId);

    if (snapshot) {
      return NextResponse.json({ source: "redis", snapshot });
    }

    // Redis no disponible o sin datos → fallback a mock
    return NextResponse.json({
      source: "mock",
      snapshot: mockDashboardSnapshot,
    });
  } catch (error) {
    console.error("[api/dashboard/snapshot] Error:", error);
    return NextResponse.json({
      source: "mock",
      snapshot: mockDashboardSnapshot,
    });
  }
}
