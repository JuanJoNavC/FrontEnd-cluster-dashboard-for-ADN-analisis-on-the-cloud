import type { DashboardSnapshot } from "@/features/dashboard/types";
import { ChunkHeatmap } from "./ChunkHeatmap";

export function ProgressPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const progress = snapshot.run.progressPercentage;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <h2 className="text-lg font-semibold text-zinc-100">Progreso del Run</h2>
      <div className="mt-3 h-4 w-full rounded-full bg-zinc-800">
        <div className="h-4 rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-sm text-zinc-300">
        {snapshot.run.completedChunks} completados, {snapshot.run.processingChunks} procesando, {snapshot.run.pendingChunks} pendientes, {snapshot.run.failedChunks} fallidos, {snapshot.run.retryingChunks} reintentando.
      </p>
      <div className="mt-4">
        <ChunkHeatmap statuses={snapshot.chunks.map((chunk) => chunk.status)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-emerald-900/40 px-2 py-1 text-emerald-200">COMPLETADO</span>
        <span className="rounded bg-blue-900/40 px-2 py-1 text-blue-200">PROCESANDO</span>
        <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-200">PENDIENTE</span>
        <span className="rounded bg-amber-900/40 px-2 py-1 text-amber-200">REINTENTANDO</span>
        <span className="rounded bg-red-900/40 px-2 py-1 text-red-200">FALLIDO</span>
      </div>
    </section>
  );
}
