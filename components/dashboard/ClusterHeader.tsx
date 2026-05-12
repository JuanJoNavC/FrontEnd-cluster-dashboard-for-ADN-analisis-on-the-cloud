import { formatTimestamp } from "@/features/dashboard/formatters";
import { runStatusStyles } from "@/features/dashboard/statusStyles";
import type { DashboardSnapshot } from "@/features/dashboard/types";
import { StatusBadge } from "./StatusBadge";

export function ClusterHeader({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Distributed DNA Cluster Dashboard</p>
          <h1 className="text-2xl font-bold text-zinc-100">Control Plane Observability Console</h1>
        </div>
        <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
          <span>Run: <strong>{snapshot.run.runId}</strong></span>
          <span>Leader: <strong>{snapshot.cluster.leaderNodeId ?? "-"}</strong></span>
          <span>Cluster: <strong>{snapshot.cluster.aliveNodes}/{snapshot.cluster.totalNodes} alive</strong></span>
          <span>Redis: <strong>{snapshot.cluster.redisConnected ? "CONNECTED" : "DISCONNECTED"}</strong></span>
          <span>Last updated: <strong>{formatTimestamp(snapshot.cluster.lastUpdatedAt)}</strong></span>
          <StatusBadge label={snapshot.run.status} className={runStatusStyles[snapshot.run.status]} />
        </div>
      </div>
    </section>
  );
}
