"use client";

import { useState, useEffect, useRef } from "react";
import type { DashboardSnapshot, WorkerNode } from "@/features/dashboard/types";
import { workerStatusStyles } from "@/features/dashboard/statusStyles";
import { workerStatusLabels } from "@/features/dashboard/translations";
import { StatusBadge } from "./StatusBadge";

// ── Barra de uso de recurso (CPU / Memoria / GPU) ────────────────────────────
function UsageBar({ label, value, color }: { label: string; value: number; color: string }) {
  const barColor =
    value >= 90 ? "bg-red-500" :
    value >= 70 ? "bg-amber-400" :
    color;
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-zinc-400">{label}</span>
        <span className="text-[10px] font-semibold text-zinc-200">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Proveedor → color/icono ───────────────────────────────────────────────────
const PROVIDER_STYLE: Record<string, string> = {
  AWS:    "text-amber-300",
  GCP:    "text-blue-300",
  ORACLE: "text-red-300",
  AZURE:  "text-cyan-300",
  LOCAL:  "text-zinc-400",
};

function WorkerCard({ worker, runId }: { worker: WorkerNode; runId: string }) {
  const [showActions, setShowActions] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    }
    if (showActions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showActions]);

  const handleAction = async (action: string, label: string) => {
    setLastAction(`${label}...`);
    setShowActions(false);
    try {
      const res = await fetch("/api/worker/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "worker", command: action, nodeId: worker.nodeId, runId }),
      });
      setLastAction(res.ok ? `✓ ${label}` : `✗ ${label} (error)`);
    } catch {
      setLastAction(`✗ ${label} (sin conexión)`);
    }
  };

  const isStale = worker.heartbeatAgeSeconds > 30;

  return (
    <div ref={menuRef} className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-3 hover:border-zinc-600 transition-colors relative">
      {/* Cabecera */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1 mr-2">
          <p className="font-mono text-sm text-zinc-100 truncate">{worker.nodeId}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] font-semibold ${PROVIDER_STYLE[worker.provider] ?? "text-zinc-400"}`}>
              {worker.provider}
            </span>
            <span className="text-[10px] text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-500">
              Prioridad {worker.priority}
            </span>
            {isStale && (
              <span className="text-[10px] text-amber-400" title="Heartbeat tardío">⚠</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusBadge label={workerStatusLabels[worker.status]} className={workerStatusStyles[worker.status]} />
          <button
            onClick={() => setShowActions(!showActions)}
            className={`text-lg px-1 py-0.5 rounded transition-all ${showActions ? "text-cyan-400 bg-zinc-800" : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800"}`}
            title="Acciones del worker"
          >⋮</button>
        </div>
      </div>

      {/* Menú desplegable */}
      {showActions && (
        <div className="absolute right-4 top-14 z-10 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl min-w-[160px] overflow-hidden">
          <div className="px-3 py-1.5 bg-zinc-800 border-b border-zinc-700">
            <p className="text-[10px] uppercase text-zinc-400 font-semibold">Acciones</p>
          </div>
          <button onClick={() => handleAction("pause", "Pausar worker")} className="w-full text-left px-4 py-2.5 text-xs text-amber-200 hover:bg-amber-950/30 transition-colors border-b border-zinc-800">⏸ Pausar worker</button>
          <button onClick={() => handleAction("resume", "Reanudar worker")} className="w-full text-left px-4 py-2.5 text-xs text-emerald-200 hover:bg-emerald-950/30 transition-colors border-b border-zinc-800">▶️ Reanudar worker</button>
          <button onClick={() => handleAction("drain", "Drenar worker")} className="w-full text-left px-4 py-2.5 text-xs text-blue-200 hover:bg-blue-950/30 transition-colors border-b border-zinc-800">🔄 Drenar worker</button>
          <button onClick={() => handleAction("disable", "Deshabilitar worker")} className="w-full text-left px-4 py-2.5 text-xs text-red-200 hover:bg-red-950/30 transition-colors">🚫 Deshabilitar worker</button>
        </div>
      )}

      {/* Barras de uso */}
      <div className="space-y-1.5 mb-3">
        <UsageBar label="CPU" value={worker.cpuUsagePercent} color="bg-blue-500" />
        <UsageBar label="Memoria" value={worker.memoryUsagePercent} color="bg-violet-500" />
        {worker.gpuUsagePercent != null && (
          <UsageBar label="GPU" value={worker.gpuUsagePercent} color="bg-emerald-500" />
        )}
      </div>

      {/* Especificaciones / métricas */}
      <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
        <div className="rounded bg-zinc-800/60 px-1 py-1">
          <p className="text-[9px] text-zinc-500 uppercase">Activos</p>
          <p className="text-sm font-bold text-zinc-200">{worker.activeJobs}</p>
        </div>
        <div className="rounded bg-zinc-800/60 px-1 py-1">
          <p className="text-[9px] text-zinc-500 uppercase">Completados</p>
          <p className="text-sm font-bold text-zinc-200">{worker.completedJobs}</p>
        </div>
        <div className="rounded bg-zinc-800/60 px-1 py-1">
          <p className="text-[9px] text-zinc-500 uppercase">Fallidos</p>
          <p className={`text-sm font-bold ${worker.failedJobs > 0 ? "text-red-400" : "text-zinc-200"}`}>{worker.failedJobs}</p>
        </div>
      </div>

      {/* Especificaciones del nodo */}
      <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-800/60 pt-2">
        <span>Concurrencia: <span className="text-zinc-300 font-medium">{worker.concurrency}</span></span>
        <span className={isStale ? "text-amber-400" : "text-zinc-500"}>
          Heartbeat: {worker.heartbeatAgeSeconds}s
        </span>
      </div>

      {/* Chunk actual */}
      {worker.currentChunkId && (
        <p className="mt-1 text-[10px] text-cyan-400 truncate" title={worker.currentChunkId}>
          ▶ {worker.currentChunkId}
        </p>
      )}

      {lastAction && (
        <p className="mt-1 text-[10px] text-cyan-300 truncate">{lastAction}</p>
      )}
    </div>
  );
}

export function ClusterTopology({ snapshot, runId }: { snapshot: DashboardSnapshot; runId: string }) {
  const leader = snapshot.workers.find((w) => w.nodeId === snapshot.cluster.leaderNodeId);
  const workers = snapshot.workers.filter((w) => w.role !== "LEADER");

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-6">
      <h2 className="text-lg font-semibold text-zinc-100 mb-4">Topología del Cluster</h2>
      
      {/* LÍDER - Grande y destacado */}
      <div className="mb-6">
        <div className="relative rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-950/50 to-emerald-900/30 p-6 shadow-xl shadow-emerald-500/20">
          <div className="absolute -top-3 left-4 bg-emerald-500 px-3 py-1 rounded-full text-xs font-bold text-black">
            👑 LÍDER ACTIVO
          </div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-emerald-100">{leader?.nodeId ?? "Sin líder"}</p>
              <div className="mt-2 flex gap-4 text-sm text-emerald-200">
                <span>Época: {snapshot.cluster.leaderEpoch}</span>
                <span>Prioridad: {leader?.priority}</span>
                <span>Jobs completados: {leader?.completedJobs}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl">👑</div>
              <p className="text-xs text-emerald-300 mt-1">{leader?.provider}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-950/50 p-2">
              <p className="text-xs text-emerald-400">CPU</p>
              <p className="text-lg font-bold text-emerald-100">{leader?.cpuUsagePercent ?? 0}%</p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-emerald-950">
                <div
                  className={`h-1.5 rounded-full ${(leader?.cpuUsagePercent ?? 0) >= 90 ? "bg-red-500" : (leader?.cpuUsagePercent ?? 0) >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${Math.min(leader?.cpuUsagePercent ?? 0, 100)}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg bg-emerald-950/50 p-2">
              <p className="text-xs text-emerald-400">Memoria</p>
              <p className="text-lg font-bold text-emerald-100">{leader?.memoryUsagePercent ?? 0}%</p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-emerald-950">
                <div
                  className={`h-1.5 rounded-full ${(leader?.memoryUsagePercent ?? 0) >= 90 ? "bg-red-500" : (leader?.memoryUsagePercent ?? 0) >= 70 ? "bg-amber-400" : "bg-violet-400"}`}
                  style={{ width: `${Math.min(leader?.memoryUsagePercent ?? 0, 100)}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg bg-emerald-950/50 p-2">
              <p className="text-xs text-emerald-400">Activos</p>
              <p className="text-lg font-bold text-emerald-100">{leader?.activeJobs ?? 0}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-emerald-300/70 border-t border-emerald-900/50 pt-2">
            <span>Concurrencia: <span className="text-emerald-200 font-medium">{leader?.concurrency ?? 1}</span></span>
            <span>Completados: <span className="text-emerald-200 font-medium">{leader?.completedJobs ?? 0}</span></span>
            {(leader?.failedJobs ?? 0) > 0 && (
              <span className="text-red-300">Fallidos: <span className="font-medium">{leader?.failedJobs}</span></span>
            )}
            <span className="ml-auto">Heartbeat: {leader?.heartbeatAgeSeconds ?? 0}s</span>
          </div>
        </div>
      </div>

      {/* WORKERS - Más pequeños, en grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {workers.map((worker) => (
          <WorkerCard key={worker.nodeId} worker={worker} runId={runId} />
        ))}
      </div>

      {/* REDIS - Coordinador central */}
      <div className="rounded-lg border border-cyan-700 bg-cyan-950/20 p-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">⚙️</div>
          <div className="flex-1">
            <p className="font-semibold text-cyan-100">Redis (Coordinador Central)</p>
            <p className="text-sm text-cyan-300">
              {snapshot.cluster.aliveNodes} nodos conectados • 
              {snapshot.cluster.redisConnected ? " CONECTADO" : " DESCONECTADO"}
            </p>
          </div>
          <div className={`h-3 w-3 rounded-full ${snapshot.cluster.redisConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
        </div>
      </div>
    </section>
  );
}
