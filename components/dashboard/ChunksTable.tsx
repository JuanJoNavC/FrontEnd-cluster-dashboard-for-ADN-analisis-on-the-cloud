"use client";

import { useMemo, useState } from "react";
import { chunkStatusStyles } from "@/features/dashboard/statusStyles";
import type { ChunkInfo, ChunkStatus } from "@/features/dashboard/types";
import { formatInt, formatRange, formatTimestamp } from "@/features/dashboard/formatters";
import { StatusBadge } from "./StatusBadge";

const filters: Array<{ key: "ALL" | ChunkStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "PROCESSING", label: "Processing" },
  { key: "DONE", label: "Done" },
  { key: "FAILED", label: "Failed" },
  { key: "RETRYING", label: "Retrying" },
];

export function ChunksTable({ chunks }: { chunks: ChunkInfo[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("ALL");

  const visibleChunks = useMemo(() => {
    const base = filter === "ALL" ? chunks : chunks.filter((chunk) => chunk.status === filter);
    return base.slice(0, 16);
  }, [chunks, filter]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Chunks</h2>
        <div className="flex flex-wrap gap-2">
          {filters.map((entry) => (
            <button
              key={entry.key}
              className={`rounded px-2 py-1 text-xs ${filter === entry.key ? "bg-cyan-700 text-cyan-100" : "bg-zinc-800 text-zinc-300"}`}
              onClick={() => setFilter(entry.key)}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1200px] text-left text-xs text-zinc-200">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              {["Chunk ID","Index","Range","Status","Worker","Matches","Mismatches","Attempts","Checksum","Updated","Action"].map((header) => (
                <th key={header} className="px-2 py-2 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleChunks.map((chunk) => (
              <tr key={chunk.chunkId} className="border-t border-zinc-800">
                <td className="px-2 py-2 font-mono">{chunk.chunkId}</td>
                <td className="px-2 py-2">{chunk.chunkIndex}</td>
                <td className="px-2 py-2">{formatRange(chunk.start, chunk.end)}</td>
                <td className="px-2 py-2"><StatusBadge label={chunk.status} className={chunkStatusStyles[chunk.status]} /></td>
                <td className="px-2 py-2 font-mono">{chunk.workerId ?? "-"}</td>
                <td className="px-2 py-2">{chunk.matches !== null ? formatInt(chunk.matches) : "-"}</td>
                <td className="px-2 py-2">{chunk.mismatches !== null ? formatInt(chunk.mismatches) : "-"}</td>
                <td className="px-2 py-2">{chunk.attempts}</td>
                <td className="px-2 py-2 font-mono">{chunk.checksum ?? "-"}</td>
                <td className="px-2 py-2">{formatTimestamp(chunk.updatedAt)}</td>
                <td className="px-2 py-2">
                  <button type="button" disabled className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 opacity-60" title="Mock only">
                    Retry chunk
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
