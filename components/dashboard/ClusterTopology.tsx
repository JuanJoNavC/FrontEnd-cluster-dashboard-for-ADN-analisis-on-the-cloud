"use client";

import { useState, useEffect, useRef } from "react";
import type { DashboardSnapshot, WorkerNode } from "@/features/dashboard/types";
import { workerStatusStyles } from "@/features/dashboard/statusStyles";
import { workerStatusLabels } from "@/features/dashboard/translations";
import { StatusBadge } from "./StatusBadge";

function WorkerCard({ worker }: { worker: WorkerNode }) {
  const [showActions, setShowActions] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer clic fuera
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

  const handleAction = (action: string, label: string) => {
    setLastAction(label);
    setShowActions(false);
    console.log(`Acción: ${action} en worker: ${worker.nodeId}`);
    // En fase real, aquí se enviaría comando a la API
  };

  return (
    <div 
      ref={menuRef}
      className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-4 hover:border-zinc-600 transition-colors relative"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-mono text-sm text-zinc-100">{worker.nodeId}</p>
          <p className="text-xs text-zinc-400">{worker.provider}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge label={workerStatusLabels[worker.status]} className={workerStatusStyles[worker.status]} />
          {/* Botón de acciones */}
          <button
            onClick={() => setShowActions(!showActions)}
            className={`text-lg transition-all px-1.5 py-0.5 rounded ${
              showActions 
                ? "text-cyan-400 bg-zinc-800" 
                : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800"
            }`}
            title="Acciones del worker"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Menú desplegable de acciones */}
      {showActions && (
        <div className="absolute right-4 top-16 z-10 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl min-w-[160px] overflow-hidden animate-fadeIn">
          <div className="px-3 py-1.5 bg-zinc-800 border-b border-zinc-700">
            <p className="text-[10px] uppercase text-zinc-400 font-semibold">Acciones</p>
          </div>
          <button
            onClick={() => handleAction("pause", "Pausar worker")}
            className="w-full text-left px-4 py-2.5 text-xs text-amber-200 hover:bg-amber-950/30 transition-colors border-b border-zinc-800"
          >
            ⏸ Pausar worker
          </button>
          <button
            onClick={() => handleAction("resume", "Reanudar worker")}
            className="w-full text-left px-4 py-2.5 text-xs text-emerald-200 hover:bg-emerald-950/30 transition-colors border-b border-zinc-800"
          >
            ▶️ Reanudar worker
          </button>
          <button
            onClick={() => handleAction("drain", "Drenar worker")}
            className="w-full text-left px-4 py-2.5 text-xs text-blue-200 hover:bg-blue-950/30 transition-colors border-b border-zinc-800"
          >
            🔄 Drenar worker
          </button>
          <button
            onClick={() => handleAction("disable", "Deshabilitar worker")}
            className="w-full text-left px-4 py-2.5 text-xs text-red-200 hover:bg-red-950/30 transition-colors"
          >
            🚫 Deshabilitar worker
          </button>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-zinc-500">Activos</p>
          <p className="font-bold text-zinc-200">{worker.activeJobs}</p>
        </div>
        <div>
          <p className="text-zinc-500">Completados</p>
          <p className="font-bold text-zinc-200">{worker.completedJobs}</p>
        </div>
      </div>

      {/* Feedback de última acción */}
      {lastAction && (
        <div className="mt-2 text-[10px] text-cyan-300 truncate" title={lastAction}>
          ✓ {lastAction}
        </div>
      )}
    </div>
  );
}

export function ClusterTopology({ snapshot }: { snapshot: DashboardSnapshot }) {
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
              <p className="text-lg font-bold text-emerald-100">{leader?.cpuUsagePercent}%</p>
            </div>
            <div className="rounded-lg bg-emerald-950/50 p-2">
              <p className="text-xs text-emerald-400">Memoria</p>
              <p className="text-lg font-bold text-emerald-100">{leader?.memoryUsagePercent}%</p>
            </div>
            <div className="rounded-lg bg-emerald-950/50 p-2">
              <p className="text-xs text-emerald-400">Activos</p>
              <p className="text-lg font-bold text-emerald-100">{leader?.activeJobs}</p>
            </div>
          </div>
        </div>
      </div>

      {/* WORKERS - Más pequeños, en grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {workers.map((worker) => (
          <WorkerCard key={worker.nodeId} worker={worker} />
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
