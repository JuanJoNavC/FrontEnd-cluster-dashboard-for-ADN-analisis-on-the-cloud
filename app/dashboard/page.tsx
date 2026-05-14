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

export default function DashboardPage() {
  const { snapshot, source, loading, error, lastFetchedAt, refresh } =
    useDashboardSnapshot(RUN_ID);

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
              <span>
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
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "Actualizando..." : "↻ Actualizar"}
            </button>
          </div>
        </div>

        <ClusterHeader snapshot={snapshot} />
        <RunOverviewCards snapshot={snapshot} />
        <ProgressPanel snapshot={snapshot} />
        <ClusterTopology snapshot={snapshot} runId={RUN_ID} />
        <ChunksTable chunks={snapshot.chunks} />
        <EventLog events={snapshot.events} />
        <CommandPanel runId={RUN_ID} />
      </div>
    </main>
  );
}
