import type { DashboardSnapshot } from "@/features/dashboard/types";
import { workerStatusStyles } from "@/features/dashboard/statusStyles";
import { StatusBadge } from "./StatusBadge";

export function ClusterTopology({ snapshot }: { snapshot: DashboardSnapshot }) {
  const leader = snapshot.workers.find((w) => w.nodeId === snapshot.cluster.leaderNodeId);
  const workers = snapshot.workers.filter((w) => w.role !== "LEADER");

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <h2 className="text-lg font-semibold text-zinc-100">Cluster Topology</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-cyan-900 bg-zinc-900 p-3">
          <p className="text-xs uppercase text-cyan-300">Control Plane</p>
          <p className="mt-2 text-sm text-zinc-200">Frontend Dashboard</p>
          <p className="text-sm text-zinc-200">API / Observer (future)</p>
          <p className="text-sm text-zinc-200">Redis Coordinator</p>
          <p className="text-sm text-zinc-200">Central Storage</p>
        </article>

        <article className="rounded-lg border border-emerald-900 bg-zinc-900 p-3">
          <p className="text-xs uppercase text-emerald-300">Leader Node</p>
          <p className="mt-2 text-sm text-zinc-100">{leader?.nodeId ?? "-"}</p>
          <p className="text-sm text-zinc-300">Epoch: {snapshot.cluster.leaderEpoch ?? "-"}</p>
          <p className="text-sm text-zinc-300">Priority: {leader?.priority ?? "-"}</p>
        </article>

        <article className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
          <p className="text-xs uppercase text-zinc-300">Worker Pool</p>
          <div className="mt-2 space-y-2">
            {workers.map((worker) => (
              <div key={worker.nodeId} className="flex items-center justify-between gap-3 rounded border border-zinc-800 p-2">
                <div>
                  <p className="text-sm text-zinc-100">{worker.nodeId}</p>
                  <p className="text-xs text-zinc-400">{worker.provider}</p>
                </div>
                <StatusBadge label={worker.status} className={workerStatusStyles[worker.status]} />
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
