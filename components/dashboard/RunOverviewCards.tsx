import { formatInt, formatPercent } from "@/features/dashboard/formatters";
import type { DashboardSnapshot } from "@/features/dashboard/types";

const cardClass = "rounded-lg border border-zinc-800 bg-zinc-900/70 p-4";

export function RunOverviewCards({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { run, workers } = snapshot;
  const activeWorkers = workers.filter((w) => w.status === "ACTIVE").length;

  const cards = [
    { label: "Total Bases", value: formatInt(run.totalBases) },
    { label: "Chunks Completed", value: `${run.completedChunks}/${run.totalChunks}` },
    { label: "Progress", value: formatPercent(run.progressPercentage, 1) },
    { label: "Current Similarity", value: run.similarityPercentage ? formatPercent(run.similarityPercentage, 2) : "-" },
    { label: "Active Workers", value: String(activeWorkers) },
    { label: "Failed/Retrying", value: `${run.failedChunks}/${run.retryingChunks}` },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <article key={card.label} className={cardClass}>
          <p className="text-xs uppercase tracking-wide text-zinc-400">{card.label}</p>
          <p className="mt-1 text-xl font-semibold text-zinc-100">{card.value}</p>
        </article>
      ))}
    </section>
  );
}
