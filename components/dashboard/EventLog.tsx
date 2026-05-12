import type { ClusterEvent } from "@/features/dashboard/types";
import { formatTimestamp } from "@/features/dashboard/formatters";

const severityStyle: Record<ClusterEvent["severity"], string> = {
  info: "text-cyan-300",
  success: "text-emerald-300",
  warning: "text-amber-300",
  error: "text-red-300",
};

export function EventLog({ events }: { events: ClusterEvent[] }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <h2 className="text-lg font-semibold text-zinc-100">Event Log</h2>
      <div className="mt-3 max-h-72 overflow-y-auto rounded border border-zinc-800 bg-black/50 p-3 font-mono text-xs">
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="border-b border-zinc-900 pb-2 last:border-b-0">
              <span className="text-zinc-500">[{formatTimestamp(event.timestamp)}]</span>{" "}
              <span className={severityStyle[event.severity]}>{event.severity.toUpperCase()}</span>{" "}
              <span className="text-zinc-300">{event.eventType}</span>{" "}
              {event.nodeId ? <span className="text-blue-300">node={event.nodeId}</span> : null}{" "}
              {event.chunkId ? <span className="text-purple-300">chunk={event.chunkId}</span> : null}{" "}
              <span className="text-zinc-200">{event.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
