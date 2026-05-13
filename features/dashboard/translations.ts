import type { ChunkStatus, RunStatus, WorkerStatus } from "./types";

export const runStatusLabels: Record<RunStatus, string> = {
  IDLE: "INACTIVO",
  PREPARING: "PREPARANDO",
  RUNNING: "EN EJECUCIÓN",
  PAUSED: "PAUSADO",
  REBUILDING: "RECONSTRUYENDO",
  COMPLETED: "COMPLETADO",
  FAILED: "FALLIDO",
  CANCELLED: "CANCELADO",
};

export const workerStatusLabels: Record<WorkerStatus, string> = {
  ACTIVE: "ACTIVO",
  PAUSED: "PAUSADO",
  DRAINING: "DRENANDO",
  DEAD: "MUERTO",
  DISABLED: "DESHABILITADO",
};

export const chunkStatusLabels: Record<ChunkStatus, string> = {
  PENDING: "PENDIENTE",
  PROCESSING: "PROCESANDO",
  DONE: "COMPLETADO",
  FAILED: "FALLIDO",
  RETRYING: "REINTENTANDO",
};
