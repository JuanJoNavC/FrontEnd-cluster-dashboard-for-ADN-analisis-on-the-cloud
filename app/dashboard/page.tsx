"use client";

import { ChunksTable } from "@/components/dashboard/ChunksTable";
import { ClusterHeader } from "@/components/dashboard/ClusterHeader";
import { ClusterTopology } from "@/components/dashboard/ClusterTopology";
import { CommandPanel } from "@/components/dashboard/CommandPanel";
import { EventLog } from "@/components/dashboard/EventLog";
import { ProgressPanel } from "@/components/dashboard/ProgressPanel";
import { RunOverviewCards } from "@/components/dashboard/RunOverviewCards";
import { useDashboardSnapshot } from "@/features/dashboard/useDashboardSnapshot";

const RUN_ID = process.env.NEXT_PUBLIC_RUN_ID ?? "run-001";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-zinc-800/60 ${className ?? ""}`} />
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <SkeletonBlock className="h-16" />
      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      {/* Progress */}
      <SkeletonBlock className="h-40" />
      {/* Topology */}
      <SkeletonBlock className="h-64" />
      {/* Table */}
      <SkeletonBlock className="h-48" />
    </div>
  );
}

export default function DashboardPage() {
  const { snapshot, source, loading, error, lastFetchedAt, refresh } =
    useDashboardSnapshot(RUN_ID);

  const isInitialLoad = loading && !lastFetchedAt;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-slate-950 to-zinc-900 px-4 py-6 text-zinc-100 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">

        {/* Barra de estado de conexión */}
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <div
              className={`h-2 w-2 rounded-full ${
                source === "redis" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>
              {source === "redis"
                ? "Conectado a Redis — datos en tiempo real"
                : "Sin Redis — mostrando datos de demostración"}
            </span>
            {error && (
              <span className="text-red-400">· Error: {error}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastFetchedAt && (
              <span suppressHydrationWarning>
                Actualizado:{" "}
                {lastFetchedAt.toLocaleTimeString("es", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <svg className="animate-spin-slow h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Actualizando…
                </>
              ) : "↻ Actualizar"}
            </button>
          </div>
        </div>

        {/* Skeleton en carga inicial */}
        {isInitialLoad ? (
          <DashboardSkeleton />
        ) : (
          <>
            <ClusterHeader snapshot={snapshot} />
            <RunOverviewCards snapshot={snapshot} />
            <ProgressPanel snapshot={snapshot} />
            <ClusterTopology snapshot={snapshot} runId={RUN_ID} />
            <ChunksTable chunks={snapshot.chunks} />
            <EventLog events={snapshot.events} />
            <CommandPanel
              runId={RUN_ID}
              status={snapshot.run.status}
              source={source}
              leaderNodeId={snapshot.cluster.leaderNodeId}
              processingChunks={snapshot.run.processingChunks}
              completedChunks={snapshot.run.completedChunks}
            />
          </>
        )}
      </div>
    </main>
  );
}
