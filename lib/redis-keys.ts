/**
 * Convenciones de keys Redis para el sistema de comparación de ADN.
 * Centralizado aquí para evitar typos y facilitar búsquedas.
 */
const KEYS = {
  // ─── LEADER ELECTION ────────────────────────────────────────────
  /** Lock del líder: JSON { nodeId, epoch, priority, timestamp } con TTL */
  leaderLock: "leader:lock",

  // ─── HEARTBEATS ─────────────────────────────────────────────────
  /** Heartbeat de un nodo específico: JSON con métricas. TTL = 30s */
  node: (nodeId: string) => `nodes:${nodeId}`,
  /** SET de IDs de nodos registrados como activos */
  nodesActive: "nodes:active",

  // ─── RUN STATE ──────────────────────────────────────────────────
  /** HASH con campos del run: status, totalChunks, completedChunks, etc. */
  runStats: (runId: string) => `runs:${runId}:stats`,
  /** STRING JSON con el manifest del run */
  runManifest: (runId: string) => `runs:${runId}:manifest`,

  // ─── CHUNKS ─────────────────────────────────────────────────────
  /** HASH con estado de un chunk: status, workerId, matches, mismatches, attempts */
  chunk: (runId: string, chunkId: string) => `chunk:${runId}:${chunkId}`,

  // ─── STREAMS ────────────────────────────────────────────────────
  /** Stream de trabajos publicados por el líder */
  jobsStream: (runId: string) => `stream:jobs:${runId}`,
  /** Stream de comandos enviados desde el dashboard */
  commandsStream: (runId: string) => `stream:commands:${runId}`,
  /** Stream de eventos del sistema (para el log del dashboard) */
  eventsStream: (runId: string) => `stream:events:${runId}`,
};

export default KEYS;
