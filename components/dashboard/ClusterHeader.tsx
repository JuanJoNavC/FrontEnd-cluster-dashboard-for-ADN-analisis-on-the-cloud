"use client";

import { useEffect, useState } from "react";
import { formatTimestamp } from "@/features/dashboard/formatters";
import type { DashboardSnapshot, RunStatus } from "@/features/dashboard/types";

const RUN_STATUS_STYLES: Record<RunStatus, { border: string; bg: string; dot: string; text: string }> = {
  IDLE:       { border: "border-zinc-600",   bg: "bg-zinc-800/60",    dot: "bg-zinc-400",                   text: "text-zinc-300"   },
  PREPARING:  { border: "border-blue-600",   bg: "bg-blue-900/40",    dot: "bg-blue-400 animate-pulse",     text: "text-blue-200"   },
  RUNNING:    { border: "border-emerald-600",bg: "bg-emerald-900/40", dot: "bg-emerald-400 animate-pulse",  text: "text-emerald-200"},
  PAUSED:     { border: "border-amber-600",  bg: "bg-amber-900/40",   dot: "bg-amber-400",                  text: "text-amber-200"  },
  REDUCING:   { border: "border-cyan-600",   bg: "bg-cyan-900/40",    dot: "bg-cyan-400 animate-pulse",     text: "text-cyan-200"   },
  REBUILDING: { border: "border-purple-600", bg: "bg-purple-900/40",  dot: "bg-purple-400 animate-pulse",   text: "text-purple-200" },
  COMPLETED:  { border: "border-emerald-500",bg: "bg-emerald-900/30", dot: "bg-emerald-400",                text: "text-emerald-300"},
  FAILED:     { border: "border-red-600",    bg: "bg-red-900/40",     dot: "bg-red-400",                    text: "text-red-200"    },
  CANCELLED:  { border: "border-zinc-600",   bg: "bg-zinc-800/60",    dot: "bg-zinc-500",                   text: "text-zinc-400"   },
};

const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  IDLE: "EN ESPERA", PREPARING: "PREPARANDO", RUNNING: "EN EJECUCIÓN",
  PAUSED: "PAUSADO", REDUCING: "REDUCIENDO", REBUILDING: "RECONSTRUYENDO",
  COMPLETED: "COMPLETADO", FAILED: "FALLIDO", CANCELLED: "CANCELADO",
};

export function ClusterHeader({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const statusStyle = RUN_STATUS_STYLES[snapshot.run.status] ?? RUN_STATUS_STYLES.IDLE;
  const statusLabel = RUN_STATUS_LABELS[snapshot.run.status] ?? snapshot.run.status;

  const healthColor = 
    snapshot.cluster.health === "HEALTHY" ? "bg-emerald-400" :
    snapshot.cluster.health === "DEGRADED" ? "bg-amber-400" :
    "bg-red-400";

  const healthText = 
    snapshot.cluster.health === "HEALTHY" ? "Cluster saludable" :
    snapshot.cluster.health === "DEGRADED" ? "Cluster degradado" :
    "Cluster crítico";

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard de Comparación Distribuida de ADN</h1>
          {/* Badge de estado del run */}
          <div className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 ${statusStyle.border} ${statusStyle.bg}`}>
            <div className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
            <span className={`text-xs font-bold tracking-wider ${statusStyle.text}`}>{statusLabel}</span>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
          <span>Run: <strong>{snapshot.run.runId}</strong></span>
          <span>Líder: <strong>{snapshot.cluster.leaderNodeId ?? "Sin líder aún"}</strong></span>
          <span>Cluster: <strong>{snapshot.cluster.aliveNodes}/{snapshot.cluster.totalNodes} vivos</strong></span>
          <div className="flex items-center gap-2">
            <span>Redis:</span>
            <div className={`h-3 w-3 rounded-full ${snapshot.cluster.redisConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <strong>{snapshot.cluster.redisConnected ? "CONECTADO" : "DESCONECTADO"}</strong>
          </div>
          <span>Actualizado: <strong>{mounted ? formatTimestamp(snapshot.cluster.lastUpdatedAt) : "..."}</strong></span>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${healthColor} animate-pulse`} />
            <span className="text-xs font-medium">{healthText}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
