"use client";

import { useState } from "react";
import type { RunStatus } from "@/features/dashboard/types";

type RunCommand = "start_run" | "pause_run" | "resume_run" | "retry_failed" | "rebuild_output" | "cancel_run";

interface CommandPanelProps {
  runId: string;
  status: RunStatus;
}

async function sendRunCommand(runId: string, command: RunCommand): Promise<boolean> {
  try {
    const res = await fetch("/api/worker/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "run", command, runId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const STATUS_LABELS: Record<RunStatus, string> = {
  IDLE: "En espera",
  PREPARING: "Preparando",
  RUNNING: "En ejecución",
  PAUSED: "Pausado",
  REDUCING: "Reduciendo",
  REBUILDING: "Reconstruyendo",
  COMPLETED: "Completado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<RunStatus, string> = {
  IDLE: "bg-zinc-400",
  PREPARING: "bg-blue-400 animate-pulse",
  RUNNING: "bg-emerald-400 animate-pulse",
  PAUSED: "bg-amber-400",
  REDUCING: "bg-cyan-400 animate-pulse",
  REBUILDING: "bg-purple-400 animate-pulse",
  COMPLETED: "bg-emerald-400",
  FAILED: "bg-red-400",
  CANCELLED: "bg-zinc-500",
};

const isIdle = (s: RunStatus) => s === "IDLE";
const isActive = (s: RunStatus) => s === "RUNNING" || s === "REDUCING" || s === "REBUILDING" || s === "PREPARING";
const isPaused = (s: RunStatus) => s === "PAUSED";
const isFinished = (s: RunStatus) => s === "COMPLETED" || s === "FAILED" || s === "CANCELLED";

export function CommandPanel({ runId, status }: CommandPanelProps) {
  const [sending, setSending] = useState<RunCommand | null>(null);
  const [lastCommand, setLastCommand] = useState<string>("ninguno");

  const handleCommand = async (cmd: RunCommand, label: string) => {
    setSending(cmd);
    const ok = await sendRunCommand(runId, cmd);
    setSending(null);
    setLastCommand(ok ? `✓ ${label}` : `✗ ${label} (error)`);
  };

  const isLoading = sending !== null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-100">Panel de Control</h2>
        <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1">
          <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]}`} />
          <span className="text-sm font-medium text-zinc-200">{STATUS_LABELS[status]}</span>
        </div>
      </div>

      {/* Botón principal cuando el run está detenido */}
      {(isIdle(status) || isFinished(status)) && (
        <button
          onClick={() => handleCommand("start_run", "Ejecutar programa")}
          disabled={isLoading}
          className="w-full mb-4 rounded-xl border-2 border-emerald-500 bg-emerald-600/20 px-6 py-4 text-lg font-bold text-emerald-300 hover:bg-emerald-600/40 hover:border-emerald-400 transition-all disabled:opacity-60 flex items-center justify-center gap-3"
        >
          {sending === "start_run" ? (
            <span className="animate-pulse">Enviando comando...</span>
          ) : (
            <>
              <span className="text-2xl">▶</span>
              {isIdle(status) ? "Ejecutar Programa" : "Reiniciar Programa"}
            </>
          )}
        </button>
      )}

      {/* Controles cuando está activo o pausado */}
      {(isActive(status) || isPaused(status)) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {isActive(status) && (
            <button
              onClick={() => handleCommand("pause_run", "Pausar run")}
              disabled={isLoading}
              className="rounded-lg border border-amber-700 bg-amber-900/40 px-4 py-3 font-medium text-amber-200 hover:bg-amber-900/60 transition-all disabled:opacity-60"
            >
              {sending === "pause_run" ? "..." : "⏸ Pausar"}
            </button>
          )}
          {isPaused(status) && (
            <button
              onClick={() => handleCommand("resume_run", "Reanudar run")}
              disabled={isLoading}
              className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-3 font-medium text-emerald-200 hover:bg-emerald-900/60 transition-all disabled:opacity-60"
            >
              {sending === "resume_run" ? "..." : "▶ Reanudar"}
            </button>
          )}
          <button
            onClick={() => handleCommand("retry_failed", "Reintentar fallidos")}
            disabled={isLoading}
            className="rounded-lg border border-blue-700 bg-blue-900/40 px-4 py-3 font-medium text-blue-200 hover:bg-blue-900/60 transition-all disabled:opacity-60"
          >
            {sending === "retry_failed" ? "..." : "🔄 Reintentar fallidos"}
          </button>
          <button
            onClick={() => handleCommand("rebuild_output", "Reconstruir output")}
            disabled={isLoading}
            className="rounded-lg border border-cyan-700 bg-cyan-900/40 px-4 py-3 font-medium text-cyan-200 hover:bg-cyan-900/60 transition-all disabled:opacity-60"
          >
            {sending === "rebuild_output" ? "..." : "🔨 Reconstruir output"}
          </button>
          <button
            onClick={() => handleCommand("cancel_run", "Cancelar run")}
            disabled={isLoading}
            className="rounded-lg border border-red-700 bg-red-900/40 px-4 py-3 font-medium text-red-200 hover:bg-red-900/60 transition-all disabled:opacity-60"
          >
            {sending === "cancel_run" ? "..." : "❌ Cancelar run"}
          </button>
        </div>
      )}

      <p className="text-xs text-zinc-500">Última acción: <span className="text-cyan-400">{lastCommand}</span></p>
    </section>
  );
}
