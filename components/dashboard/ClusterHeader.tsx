import { formatTimestamp } from "@/features/dashboard/formatters";
import type { DashboardSnapshot } from "@/features/dashboard/types";

export function ClusterHeader({ snapshot }: { snapshot: DashboardSnapshot }) {
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
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard de Comparación Distribuida de ADN</h1>
        </div>
        <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
          <span>Run: <strong>{snapshot.run.runId}</strong></span>
          <span>Líder: <strong>{snapshot.cluster.leaderNodeId ?? "-"}</strong></span>
          <span>Cluster: <strong>{snapshot.cluster.aliveNodes}/{snapshot.cluster.totalNodes} vivos</strong></span>
          <div className="flex items-center gap-2">
            <span>Redis:</span>
            <div className={`h-3 w-3 rounded-full ${snapshot.cluster.redisConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <strong>{snapshot.cluster.redisConnected ? "CONECTADO" : "DESCONECTADO"}</strong>
          </div>
          <span>Actualizado: <strong>{formatTimestamp(snapshot.cluster.lastUpdatedAt)}</strong></span>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${healthColor} animate-pulse`} />
            <span className="text-xs font-medium">{healthText}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
