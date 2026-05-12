"use client";

import { useState } from "react";

const commands = [
  "Pause run",
  "Resume run",
  "Retry failed chunks",
  "Rebuild final output",
  "Cancel run",
];

export function CommandPanel() {
  const [lastCommand, setLastCommand] = useState<string>("none");

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <h2 className="text-lg font-semibold text-zinc-100">Command Panel</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Mock phase only. Future commands will be sent to a backend API contract, never directly from browser to Redis.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {commands.map((command) => (
          <button
            key={command}
            type="button"
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={() => setLastCommand(`${command} queued (mock)`) }
          >
            {command}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-cyan-300">Last action: {lastCommand}</p>
    </section>
  );
}
