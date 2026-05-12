import { formatHeartbeatAge } from "@/features/dashboard/formatters";
import { workerStatusStyles } from "@/features/dashboard/statusStyles";
import type { DashboardSnapshot } from "@/features/dashboard/types";
import { StatusBadge } from "./StatusBadge";

function WorkerActions() {
  const actionClass = "rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-1">
      <button disabled className={actionClass} title="Mock only">Pause</button>
      <button disabled className={actionClass} title="Mock only">Resume</button>
      <button disabled className={actionClass} title="Mock only">Drain</button>
      <button disabled className={actionClass} title="Mock only">Disable</button>
      <span className="text-[10px] text-zinc-500">mock-only</span>
    </div>
  );
}

export function WorkersTable({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <h2 className="text-lg font-semibold text-zinc-100">Workers</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1200px] text-left text-xs text-zinc-200">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              {[
                "Node ID","Role","Status","Priority","Can Be Leader","Heartbeat","CPU","Memory","Concurrency","Active","Completed","Failed","Current Chunk","Actions"
              ].map((header) => (
                <th key={header} className="px-2 py-2 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {snapshot.workers.map((worker) => (
              <tr key={worker.nodeId} className="border-t border-zinc-800">
                <td className="px-2 py-2 font-mono">{worker.nodeId}</td>
                <td className="px-2 py-2">{worker.role}</td>
                <td className="px-2 py-2"><StatusBadge label={worker.status} className={workerStatusStyles[worker.status]} /></td>
                <td className="px-2 py-2">{worker.priority}</td>
                <td className="px-2 py-2">{worker.canBeLeader ? "YES" : "NO"}</td>
                <td className="px-2 py-2">{formatHeartbeatAge(worker.heartbeatAgeSeconds)}</td>
                <td className="px-2 py-2">{worker.cpuUsagePercent}%</td>
                <td className="px-2 py-2">{worker.memoryUsagePercent}%</td>
                <td className="px-2 py-2">{worker.concurrency}</td>
                <td className="px-2 py-2">{worker.activeJobs}</td>
                <td className="px-2 py-2">{worker.completedJobs}</td>
                <td className="px-2 py-2">{worker.failedJobs}</td>
                <td className="px-2 py-2 font-mono">{worker.currentChunkId ?? "-"}</td>
                <td className="px-2 py-2"><WorkerActions /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
