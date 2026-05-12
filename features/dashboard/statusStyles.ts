import type { ChunkStatus, RunStatus, WorkerStatus } from "./types";

export const runStatusStyles: Record<RunStatus, string> = {
  IDLE: "bg-zinc-700 text-zinc-200",
  PREPARING: "bg-cyan-900/50 text-cyan-200",
  RUNNING: "bg-emerald-900/50 text-emerald-200",
  PAUSED: "bg-amber-900/50 text-amber-200",
  REBUILDING: "bg-blue-900/50 text-blue-200",
  COMPLETED: "bg-emerald-900/50 text-emerald-200",
  FAILED: "bg-red-900/50 text-red-200",
  CANCELLED: "bg-red-900/50 text-red-200",
};

export const workerStatusStyles: Record<WorkerStatus, string> = {
  ACTIVE: "bg-emerald-900/50 text-emerald-200",
  PAUSED: "bg-zinc-700 text-zinc-200",
  DRAINING: "bg-amber-900/50 text-amber-200",
  DEAD: "bg-red-900/50 text-red-200",
  DISABLED: "bg-zinc-800 text-zinc-300",
};

export const chunkStatusStyles: Record<ChunkStatus, string> = {
  PENDING: "bg-zinc-700 text-zinc-200",
  PROCESSING: "bg-blue-900/50 text-blue-200",
  DONE: "bg-emerald-900/50 text-emerald-200",
  FAILED: "bg-red-900/50 text-red-200",
  RETRYING: "bg-amber-900/50 text-amber-200",
};
