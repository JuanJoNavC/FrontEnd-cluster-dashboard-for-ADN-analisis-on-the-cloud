import type { ChunkStatus } from "@/features/dashboard/types";

const heatmapClass: Record<ChunkStatus, string> = {
  DONE: "bg-emerald-400",
  PROCESSING: "bg-blue-400",
  PENDING: "bg-zinc-600",
  FAILED: "bg-red-500",
  RETRYING: "bg-amber-400",
};

export function ChunkHeatmap({ statuses }: { statuses: ChunkStatus[] }) {
  return (
    <div className="grid grid-cols-15 gap-1 sm:grid-cols-18">
      {statuses.map((status, index) => (
        <div
          key={`${status}-${index}`}
          className={`h-3 w-3 rounded-[2px] ${heatmapClass[status]}`}
          title={`Chunk ${index} - ${status}`}
        />
      ))}
    </div>
  );
}
