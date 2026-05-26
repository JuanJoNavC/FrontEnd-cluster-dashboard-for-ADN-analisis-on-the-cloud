"use client";

import { useState } from "react";
import type { RunStatus } from "@/features/dashboard/types";

type RunCommand = "start_run" | "pause_run" | "resume_run" | "retry_failed" | "rebuild_output" | "cancel_run";

interface CommandPanelProps {
  runId: string;
  status: RunStatus;
  source: "redis" | "mock";
  leaderNodeId: string | null;
  processingChunks: number;
  completedChunks: number;
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

function Spinner() {
  return (
    <svg className="animate-spin-slow h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
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

export function CommandPanel({ runId, status, source, leaderNodeId, processingChunks, completedChunks }: CommandPanelProps) {
  // Si los datos vienen del mock, el backend no tiene run activo → tratar como IDLE
  const effectiveStatus: RunStatus = source === "mock" ? "IDLE" : status;
  // Run "bloqueado": RUNNING pero sin líder y sin progreso
  const isStalled = source === "redis" && status === "RUNNING" && !leaderNodeId && processingChunks === 0 && completedChunks === 0;
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
          <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[effectiveStatus]}`} />
          <span className="text-sm font-medium text-zinc-200">{STATUS_LABELS[effectiveStatus]}</span>
          {source === "mock" && (
            <span className="text-xs text-zinc-500 ml-1">(sin datos reales)</span>
          )}
        </div>
      </div>

      {/* Alerta: run bloqueado - RUNNING sin líder ni progreso */}
      {isStalled && (
        <div className="mb-4 rounded-lg border border-amber-700 bg-amber-900/20 p-3">
          <p className="text-sm text-amber-300 font-medium mb-1">⚠ Run bloqueado — sin líder electo</p>
          <p className="text-xs text-amber-400/80 mb-3">
            El run está marcado como RUNNING pero ningún worker ha asumido el rol de líder.
            Envía el comando <code className="bg-amber-900/40 px-1 rounded">start_run</code> para reactivar el procesamiento.
          </p>
          <button
            onClick={() => handleCommand("start_run", "Iniciar procesamiento")}
            disabled={isLoading}
            className="w-full rounded-lg border-2 border-emerald-500 bg-emerald-600/20 px-4 py-3 text-base font-bold text-emerald-300 hover:bg-emerald-600/40 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {sending === "start_run" ? (
              <>
                <svg className="animate-spin-slow h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enviando comando…
              </>
            ) : (
              <><span>▶</span> Iniciar Procesamiento</>
            )}
          </button>
        </div>
      )}

      {/* Botón principal cuando el run está detenido */}
      {(isIdle(effectiveStatus) || isFinished(effectiveStatus)) && (
        <button
          onClick={() => handleCommand("start_run", "Ejecutar programa")}
          disabled={isLoading}
          className="w-full mb-4 rounded-xl border-2 border-emerald-500 bg-emerald-600/20 px-6 py-4 text-lg font-bold text-emerald-300 hover:bg-emerald-600/40 hover:border-emerald-400 transition-all disabled:opacity-60 flex items-center justify-center gap-3"
        >
          {sending === "start_run" ? (
            <>
              <svg className="animate-spin-slow h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Enviando comando…
            </>
          ) : (
            <>
              <span className="text-2xl">▶</span>
              {isIdle(effectiveStatus) ? "Ejecutar Programa" : "Reiniciar Programa"}
            </>
          )}
        </button>
      )}

      {/* Controles cuando está activo o pausado */}
      {(isActive(effectiveStatus) || isPaused(effectiveStatus)) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          {isActive(effectiveStatus) && (
            <button
              onClick={() => handleCommand("pause_run", "Pausar run")}
              disabled={isLoading}
              className="rounded-lg border border-amber-700 bg-amber-900/40 px-4 py-3 font-medium text-amber-200 hover:bg-amber-900/60 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {sending === "pause_run" ? <Spinner /> : "⏸ Pausar"}
            </button>
          )}
          {isPaused(effectiveStatus) && (
            <button
              onClick={() => handleCommand("resume_run", "Reanudar run")}
              disabled={isLoading}
              className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-3 font-medium text-emerald-200 hover:bg-emerald-900/60 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {sending === "resume_run" ? <Spinner /> : "▶ Reanudar"}
            </button>
          )}
          <button
            onClick={() => handleCommand("retry_failed", "Reintentar fallidos")}
            disabled={isLoading}
            className="rounded-lg border border-blue-700 bg-blue-900/40 px-4 py-3 font-medium text-blue-200 hover:bg-blue-900/60 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {sending === "retry_failed" ? <Spinner /> : "🔄 Reintentar fallidos"}
          </button>
          <button
            onClick={() => handleCommand("rebuild_output", "Reconstruir output")}
            disabled={isLoading}
            className="rounded-lg border border-cyan-700 bg-cyan-900/40 px-4 py-3 font-medium text-cyan-200 hover:bg-cyan-900/60 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {sending === "rebuild_output" ? <Spinner /> : "🔨 Reconstruir output"}
          </button>
          <button
            onClick={() => handleCommand("cancel_run", "Cancelar run")}
            disabled={isLoading}
            className="rounded-lg border border-red-700 bg-red-900/40 px-4 py-3 font-medium text-red-200 hover:bg-red-900/60 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {sending === "cancel_run" ? <Spinner /> : "❌ Cancelar run"}
          </button>
        </div>
      )}

      <p className="text-xs text-zinc-500">Última acción: <span className="text-cyan-400">{lastCommand}</span></p>
    </section>
  );
}
