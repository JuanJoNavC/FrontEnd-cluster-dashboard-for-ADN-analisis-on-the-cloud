import type { ChunkInfo, ChunkStatus, DashboardSnapshot, WorkerNode } from "./types";

const RUN_ID = "run-001";
const TOTAL_CHUNKS = 90;
const CHUNK_SIZE = 33554432;

function buildWorkers(): WorkerNode[] {
  return [
    {
      nodeId: "aws-node-1",
      role: "LEADER",
      status: "ACTIVE",
      priority: 100,
      canBeLeader: true,
      heartbeatAgeSeconds: 3,
      cpuUsagePercent: 72,
      memoryUsagePercent: 58,
      concurrency: 4,
      activeJobs: 2,
      completedJobs: 26,
      failedJobs: 0,
      currentChunkId: "chunk_000062",
      provider: "AWS",
    },
    {
      nodeId: "azure-node-1",
      role: "WORKER",
      status: "ACTIVE",
      priority: 80,
      canBeLeader: true,
      heartbeatAgeSeconds: 5,
      cpuUsagePercent: 67,
      memoryUsagePercent: 62,
      concurrency: 3,
      activeJobs: 1,
      completedJobs: 20,
      failedJobs: 1,
      currentChunkId: "chunk_000063",
      provider: "AZURE",
    },
    {
      nodeId: "gcp-node-1",
      role: "WORKER",
      status: "ACTIVE",
      priority: 70,
      canBeLeader: true,
      heartbeatAgeSeconds: 6,
      cpuUsagePercent: 61,
      memoryUsagePercent: 49,
      concurrency: 3,
      activeJobs: 1,
      completedJobs: 16,
      failedJobs: 0,
      currentChunkId: "chunk_000064",
      provider: "GCP",
    },
    {
      nodeId: "local-node-1",
      role: "WORKER",
      status: "DRAINING",
      priority: 60,
      canBeLeader: false,
      heartbeatAgeSeconds: 96,
      cpuUsagePercent: 24,
      memoryUsagePercent: 33,
      concurrency: 2,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 1,
      currentChunkId: null,
      provider: "LOCAL",
    },
  ];
}

function buildChunk(index: number): ChunkInfo {
  const chunkId = `chunk_${index.toString().padStart(6, "0")}`;
  const start = index * CHUNK_SIZE;
  const end = start + CHUNK_SIZE;
  let status: ChunkStatus = "PENDING";

  if (index < 62) status = "DONE";
  if (index >= 62 && index <= 64) status = "PROCESSING";
  if (index === 65) status = "FAILED";
  if (index === 66) status = "RETRYING";

  const workerId =
    status === "DONE"
      ? ["aws-node-1", "azure-node-1", "gcp-node-1"][index % 3]
      : status === "PROCESSING"
        ? ["aws-node-1", "azure-node-1", "gcp-node-1"][index - 62]
        : status === "FAILED" || status === "RETRYING"
          ? "local-node-1"
          : null;

  return {
    chunkId,
    chunkIndex: index,
    start,
    end,
    status,
    workerId,
    matches: status === "DONE" ? CHUNK_SIZE - (index % 1700) : null,
    mismatches: status === "DONE" ? index % 1700 : null,
    attempts: status === "RETRYING" ? 2 : status === "FAILED" ? 1 : 1,
    checksum: status === "DONE" ? `sha256:mock${index.toString().padStart(6, "0")}` : null,
    updatedAt: new Date(Date.now() - (TOTAL_CHUNKS - index) * 20000).toISOString(),
  };
}

export const mockDashboardSnapshot: DashboardSnapshot = {
  run: {
    runId: RUN_ID,
    status: "RUNNING",
    totalBases: 3_000_000_000,
    totalChunks: TOTAL_CHUNKS,
    completedChunks: 62,
    pendingChunks: 23,
    processingChunks: 3,
    failedChunks: 1,
    retryingChunks: 1,
    progressPercentage: (62 / TOTAL_CHUNKS) * 100,
    matches: 2_987_000_000,
    mismatches: 13_000_000,
    similarityPercentage: 99.54,
    startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    finishedAt: null,
  },
  cluster: {
    leaderNodeId: "aws-node-1",
    leaderEpoch: 7,
    redisConnected: true,
    aliveNodes: 3,
    totalNodes: 4,
    health: "DEGRADED",
    lastUpdatedAt: new Date().toISOString(),
  },
  workers: buildWorkers(),
  chunks: Array.from({ length: TOTAL_CHUNKS }, (_, index) => buildChunk(index)),
  events: [
    {
      id: "evt-001",
      timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      severity: "success",
      eventType: "leader_elected",
      nodeId: "aws-node-1",
      message: "Leader election completed. aws-node-1 acquired leader:lock (epoch 7).",
    },
    {
      id: "evt-002",
      timestamp: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      severity: "info",
      eventType: "heartbeat_received",
      nodeId: "gcp-node-1",
      message: "Heartbeat received with stable latency and worker capacity.",
    },
    {
      id: "evt-003",
      timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      severity: "success",
      eventType: "chunk_completed",
      nodeId: "azure-node-1",
      chunkId: "chunk_000060",
      message: "Chunk chunk_000060 uploaded and ACKed after checksum validation.",
    },
    {
      id: "evt-004",
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      severity: "error",
      eventType: "worker_failure",
      nodeId: "local-node-1",
      message: "Worker missed heartbeat threshold and was marked as unavailable.",
    },
    {
      id: "evt-005",
      timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      severity: "warning",
      eventType: "chunk_reclaimed",
      nodeId: "aws-node-1",
      chunkId: "chunk_000066",
      message: "Leader reclaimed chunk_000066 and republished it for retry.",
    },
    {
      id: "evt-006",
      timestamp: new Date(Date.now() - 90 * 1000).toISOString(),
      severity: "info",
      eventType: "heartbeat_received",
      nodeId: "aws-node-1",
      message: "Leader heartbeat refreshed and lock renewal confirmed.",
    },
  ],
};
