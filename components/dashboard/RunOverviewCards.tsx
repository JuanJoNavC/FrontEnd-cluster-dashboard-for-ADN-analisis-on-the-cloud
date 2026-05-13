import { formatInt, formatPercent } from "@/features/dashboard/formatters";
import type { DashboardSnapshot } from "@/features/dashboard/types";

export function RunOverviewCards({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { run, workers } = snapshot;
  const activeWorkers = workers.filter((w) => w.status === "ACTIVE").length;

  const cards = [
    { 
      label: "Bases Totales", 
      value: formatInt(run.totalBases),
      icon: "🧬"
    },
    { 
      label: "Chunks Completados", 
      value: `${run.completedChunks}/${run.totalChunks}`,
      icon: "✓"
    },
    { 
      label: "Progreso", 
      value: formatPercent(run.progressPercentage, 1),
      icon: "📊"
    },
    { 
      label: "Similitud Actual", 
      value: run.similarityPercentage ? formatPercent(run.similarityPercentage, 2) : "Calculando...",
      icon: "🎯"
    },
    { 
      label: "Workers Activos", 
      value: String(activeWorkers),
      icon: "⚡"
    },
    { 
      label: "Fallidos / Reintentando", 
      value: `${run.failedChunks} / ${run.retryingChunks}`,
      icon: run.failedChunks > 0 ? "⚠️" : "✓"
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <article 
          key={card.label} 
          className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{card.label}</p>
            <span className="text-xl">{card.icon}</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{card.value}</p>
        </article>
      ))}
    </section>
  );
}
