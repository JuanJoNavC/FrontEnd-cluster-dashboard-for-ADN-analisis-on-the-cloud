"use client";

import { useState } from "react";

type RunCommand = "pause_run" | "resume_run" | "retry_failed" | "rebuild_output" | "cancel_run";

interface CommandPanelProps {
  runId: string;
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

export function CommandPanel({ runId }: CommandPanelProps) {
  const [runState, setRunState] = useState<"running" | "paused">("running");
  const [sending, setSending] = useState<RunCommand | null>(null);
  const [lastCommand, setLastCommand] = useState<string>("ninguno");

  const handleCommand = async (cmd: RunCommand, label: string) => {
    setSending(cmd);
    const ok = await sendRunCommand(runId, cmd);
    setSending(null);
    setLastCommand(ok ? `✓ ${label}` : `✗ ${label} (error)`);
    if (cmd === "pause_run") setRunState("paused");
    if (cmd === "resume_run") setRunState("running");
  };

  const isLoading = sending !== null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <h2 className="text-lg font-semibold text-zinc-100 mb-3">Panel de Control</h2>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button
          onClick={() => handleCommand(
            runState === "running" ? "pause_run" : "resume_run",
            runState === "running" ? "Pausar run" : "Reanudar run"
          )}
          disabled={isLoading}
          className={`rounded-lg px-4 py-3 font-medium transition-all disabled:opacity-60 ${
            runState === "running"
              ? "bg-amber-900/40 text-amber-200 hover:bg-amber-900/60 border border-amber-700"
              : "bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/60 border border-emerald-700"
          }`}
        >
          {sending === "pause_run" || sending === "resume_run"
            ? "..."
            : runState === "running"
            ? "⏸ Pausar"
            : "▶️ Reanudar"}
        </button>

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

        <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3 flex items-center justify-center">
          <div className={`h-3 w-3 rounded-full mr-2 ${runState === "running" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          <span className="text-sm font-medium text-zinc-200">
            {runState === "running" ? "En ejecución" : "Pausado"}
          </span>
        </div>
      </div>
      
      <p className="mt-3 text-xs text-cyan-300">Última acción: {lastCommand}</p>
    </section>
  );
}
