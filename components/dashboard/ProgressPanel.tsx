import type { DashboardSnapshot, RunStatus } from "@/features/dashboard/types";
import { ChunkHeatmap } from "./ChunkHeatmap";

const ACTIVE_STATUSES: RunStatus[] = ["RUNNING", "REDUCING", "PREPARING", "REBUILDING"];

export function ProgressPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const progress = snapshot.run.progressPercentage;
  const isActive = ACTIVE_STATUSES.includes(snapshot.run.status);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-zinc-100">Progreso del Run</h2>
        {isActive && (
          <span className="flex items-center gap-1.5 text-xs text-cyan-400">
            <svg className="animate-spin-slow h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Procesando…
          </span>
        )}
      </div>

      {/* Barra de progreso con shimmer cuando está activo */}
      <div className="relative h-4 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-4 rounded-full transition-all duration-700 ${
            isActive ? "bg-gradient-to-r from-cyan-500 to-blue-500" : "bg-cyan-400"
          }`}
          style={{ width: `${progress}%` }}
        />
        {isActive && (
          <div className="absolute inset-y-0 left-0 w-1/3 animate-shimmer">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12" />
          </div>
        )}
      </div>

      <p className="mt-2 text-sm text-zinc-300">
        {snapshot.run.completedChunks} completados,{" "}
        {snapshot.run.processingChunks} procesando,{" "}
        {snapshot.run.pendingChunks} pendientes,{" "}
        {snapshot.run.failedChunks} fallidos,{" "}
        {snapshot.run.retryingChunks} reintentando.
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
