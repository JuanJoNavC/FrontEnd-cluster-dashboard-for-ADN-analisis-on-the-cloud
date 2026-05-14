/**
 * Seed script: puebla Redis con datos de demostración
 * Uso: node scripts/seed-redis.mjs
 */

import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const RUN_ID = process.env.NEXT_PUBLIC_RUN_ID ?? "run-001";

const client = createClient({ url: REDIS_URL });
await client.connect();
console.log("[seed] Conectado a Redis en", REDIS_URL);

// ── 1. Estadísticas del run ────────────────────────────────────────────────
await client.hSet(`runs:${RUN_ID}:stats`, {
  status: "RUNNING",
  totalBases: "3000000000",
  totalChunks: "90",
  completedChunks: "62",
  pendingChunks: "23",
  processingChunks: "3",
  failedChunks: "1",
  retryingChunks: "1",
  matches: "2985642000",
  mismatches: "14358000",
  similarityPercentage: "99.54",
  startedAt: new Date(Date.now() - 3600000).toISOString(),
  finishedAt: "",
});
console.log("[seed] ✓ runs stats");

// ── 2. Líder ───────────────────────────────────────────────────────────────
await client.set(
  "leader:lock",
  JSON.stringify({ nodeId: "aws-node-1", epoch: 7 }),
  { EX: 300 }
);
console.log("[seed] ✓ leader lock");

// ── 3. Nodos activos (SET) ─────────────────────────────────────────────────
const nodes = [
  {
    nodeId: "aws-node-1",
    status: "ACTIVE",
    priority: 100,
    canBeLeader: true,
    cpuUsage: 72,
    memoryUsage: 58,
    concurrency: 4,
    activeJobs: 2,
    completedJobs: 26,
    failedJobs: 0,
    currentChunkId: "chunk_000062",
    provider: "AWS",
    timestamp: Date.now() - 3000,
  },
  {
    nodeId: "azure-node-1",
    status: "ACTIVE",
    priority: 80,
    canBeLeader: true,
    cpuUsage: 67,
    memoryUsage: 62,
    concurrency: 3,
    activeJobs: 1,
    completedJobs: 20,
    failedJobs: 1,
    currentChunkId: "chunk_000063",
    provider: "AZURE",
    timestamp: Date.now() - 5000,
  },
  {
    nodeId: "gcp-node-1",
    status: "ACTIVE",
    priority: 70,
    canBeLeader: true,
    cpuUsage: 61,
    memoryUsage: 49,
    concurrency: 3,
    activeJobs: 1,
    completedJobs: 16,
    failedJobs: 0,
    currentChunkId: "chunk_000064",
    provider: "GCP",
    timestamp: Date.now() - 6000,
  },
  {
    nodeId: "local-node-1",
    status: "DRAINING",
    priority: 60,
    canBeLeader: false,
    cpuUsage: 24,
    memoryUsage: 33,
    concurrency: 2,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 1,
    currentChunkId: null,
    provider: "LOCAL",
    timestamp: Date.now() - 96000,
  },
];

// Limpiar set previo
await client.del("nodes:active");

for (const node of nodes) {
  await client.sAdd("nodes:active", node.nodeId);
  await client.set(`nodes:${node.nodeId}`, JSON.stringify(node), { EX: 120 });
}
console.log("[seed] ✓ nodes (" + nodes.length + ")");

// ── 4. Chunks ──────────────────────────────────────────────────────────────
const CHUNK_SIZE = 33554432;
const TOTAL_CHUNKS = 90;

for (let i = 0; i < TOTAL_CHUNKS; i++) {
  const chunkId = `chunk_${i.toString().padStart(6, "0")}`;
  const start = i * CHUNK_SIZE;
  const end = start + CHUNK_SIZE;

  let status = "PENDING";
  if (i < 62) status = "DONE";
  else if (i >= 62 && i <= 64) status = "PROCESSING";
  else if (i === 65) status = "FAILED";
  else if (i === 66) status = "RETRYING";

  const workerMap = ["aws-node-1", "azure-node-1", "gcp-node-1"];
  const workerId =
    status === "DONE"
      ? workerMap[i % 3]
      : status === "PROCESSING"
        ? workerMap[i - 62]
        : status === "FAILED" || status === "RETRYING"
          ? "local-node-1"
          : "";

  await client.hSet(`chunk:${RUN_ID}:${chunkId}`, {
    chunkIndex: String(i),
    start: String(start),
    end: String(end),
    status,
    workerId: workerId ?? "",
    matches: status === "DONE" ? String(CHUNK_SIZE - (i % 1700)) : "",
    mismatches: status === "DONE" ? String(i % 1700) : "",
    attempts: status === "RETRYING" ? "2" : "1",
    checksum: status === "DONE" ? `sha256:mock${i.toString().padStart(6, "0")}` : "",
    updatedAt: new Date(Date.now() - (TOTAL_CHUNKS - i) * 20000).toISOString(),
  });
}
console.log("[seed] ✓ chunks (90)");

// ── 5. Eventos recientes (stream) ──────────────────────────────────────────
const sampleEvents = [
  { severity: "success", eventType: "chunk_completed", nodeId: "aws-node-1",   chunkId: "chunk_000061", message: "Chunk completado exitosamente" },
  { severity: "success", eventType: "chunk_completed", nodeId: "azure-node-1", chunkId: "chunk_000060", message: "Chunk completado exitosamente" },
  { severity: "warning", eventType: "node_draining",   nodeId: "local-node-1", chunkId: "",             message: "Nodo iniciando drenaje de carga" },
  { severity: "error",   eventType: "chunk_failed",    nodeId: "local-node-1", chunkId: "chunk_000065", message: "Chunk fallido después de 1 intento" },
  { severity: "info",    eventType: "leader_elected",  nodeId: "aws-node-1",   chunkId: "",             message: "aws-node-1 elegido como nuevo líder (época 7)" },
  { severity: "info",    eventType: "run_started",     nodeId: "aws-node-1",   chunkId: "",             message: "Run run-001 iniciado con 90 chunks" },
];

const streamKey = `stream:events:${RUN_ID}`;
try { await client.del(streamKey); } catch {}

for (const ev of sampleEvents) {
  await client.xAdd(streamKey, "*", {
    timestamp: new Date(Date.now() - Math.random() * 600000).toISOString(),
    severity: ev.severity,
    eventType: ev.eventType,
    nodeId: ev.nodeId,
    chunkId: ev.chunkId,
    message: ev.message,
  });
}
console.log("[seed] ✓ events stream (6)");

await client.disconnect();
console.log("\n[seed] ✅ Redis sembrado correctamente. Recarga el dashboard.");
