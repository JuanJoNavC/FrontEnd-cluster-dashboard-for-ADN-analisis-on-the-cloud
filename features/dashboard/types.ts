export type WorkerStatus = "ACTIVE" | "PAUSED" | "DRAINING" | "DEAD" | "DISABLED";

export type ChunkStatus =
  | "PENDING"
  | "PROCESSING"
  | "DONE"
  | "FAILED"
  | "RETRYING";

export type RunStatus =
  | "IDLE"
  | "PREPARING"
  | "RUNNING"
  | "PAUSED"
  | "REDUCING"
  | "REBUILDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type WorkerRole = "LEADER" | "WORKER" | "CANDIDATE";

export interface RunOverview {
  runId: string;
  status: RunStatus;
  totalBases: number;
  totalChunks: number;
  completedChunks: number;
  pendingChunks: number;
  processingChunks: number;
  failedChunks: number;
  retryingChunks: number;
  progressPercentage: number;
  matches: number;
  mismatches: number;
  similarityPercentage: number | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface WorkerNode {
  nodeId: string;
  role: WorkerRole;
  status: WorkerStatus;
  priority: number;
  canBeLeader: boolean;
  heartbeatAgeSeconds: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  concurrency: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  currentChunkId: string | null;
  provider: "AWS" | "AZURE" | "GCP" | "LOCAL";
}

export interface ChunkInfo {
  chunkId: string;
  chunkIndex: number;
  start: number;
  end: number;
  status: ChunkStatus;
  workerId: string | null;
  matches: number | null;
  mismatches: number | null;
  attempts: number;
  checksum: string | null;
  updatedAt: string;
}

export interface ClusterEvent {
  id: string;
  timestamp: string;
  severity: "info" | "success" | "warning" | "error";
  eventType: string;
  nodeId?: string;
  chunkId?: string;
  message: string;
}

export interface DashboardSnapshot {
  run: RunOverview;
  cluster: {
    leaderNodeId: string | null;
    leaderEpoch: number | null;
    redisConnected: boolean;
    aliveNodes: number;
    totalNodes: number;
    health: "HEALTHY" | "DEGRADED" | "CRITICAL";
    lastUpdatedAt: string;
  };
  workers: WorkerNode[];
  chunks: ChunkInfo[];
  events: ClusterEvent[];
}
