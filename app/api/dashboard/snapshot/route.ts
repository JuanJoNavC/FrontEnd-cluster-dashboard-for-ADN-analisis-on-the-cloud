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
  const runStats = await redis.hgetall(KEYS.runStats(runId));
  if (!runStats || Object.keys(runStats).length === 0) {
    // No hay datos del run en Redis → aún no arrancó
    return null;
  }

  const totalChunks = safeParseInt(runStats.totalChunks, 0);
  const completedChunks = safeParseInt(runStats.completedChunks, 0);
  const processingChunks = safeParseInt(runStats.processingChunks, 0);
  const pendingChunks = safeParseInt(runStats.pendingChunks, 0);
  const failedChunks = safeParseInt(runStats.failedChunks, 0);
  const retryingChunks = safeParseInt(runStats.retryingChunks, 0);
  const totalBases = safeParseInt(runStats.totalBases, 0);
  const matches = safeParseInt(runStats.matches, 0);
  const mismatches = safeParseInt(runStats.mismatches, 0);

  const run = {
    runId,
    status: (runStats.status ?? "IDLE") as RunStatus,
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
        ? safeParseFloat(runStats.similarityPercentage, (matches / totalBases) * 100)
        : null,
    startedAt: runStats.startedAt ?? null,
    finishedAt: runStats.finishedAt ?? null,
  };

  // ── 3. Líder actual ────────────────────────────────────────────────────────
  const leaderRaw = await redis.get(KEYS.leaderLock);
  let leaderNodeId: string | null = null;
  let leaderEpoch: number | null = null;

  if (leaderRaw) {
    try {
      const parsed = JSON.parse(leaderRaw);
      leaderNodeId = parsed.nodeId ?? null;
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
        cpuUsagePercent: safeParseInt(data.cpuUsage, 0),
        memoryUsagePercent: safeParseInt(data.memoryUsage, 0),
        concurrency: safeParseInt(data.concurrency, 1),
        activeJobs: safeParseInt(data.activeJobs, 0),
        completedJobs: safeParseInt(data.completedJobs, 0),
        failedJobs: safeParseInt(data.failedJobs, 0),
        currentChunkId: data.currentChunkId ?? null,
        provider: data.provider ?? "LOCAL",
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
      chunkIndex: safeParseInt(data.chunkIndex, 0),
      start: safeParseInt(data.start, 0),
      end: safeParseInt(data.end, 0),
      status: (data.status ?? "PENDING") as ChunkInfo["status"],
      workerId: data.workerId || null,
      matches: data.matches ? safeParseInt(data.matches) : null,
      mismatches: data.mismatches ? safeParseInt(data.mismatches) : null,
      attempts: safeParseInt(data.attempts, 1),
      checksum: data.checksum ?? null,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
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
