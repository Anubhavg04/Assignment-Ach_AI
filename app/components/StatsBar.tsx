"use client";

import { formatUptime } from "../lib/format";
import type { SessionStats } from "../hooks/useAgentWebSocket";

interface StatsBarProps {
  stats: SessionStats;
  onClearChat: () => void;
  onChaosMode: () => void;
}

export function StatsBar({ stats, onClearChat, onChaosMode }: StatsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-zinc-400">
        <span>
          Seq: <span className="text-zinc-200">#{stats.lastSeq}</span>
        </span>
        <span>
          Uptime: <span className="text-zinc-200">{formatUptime(stats.uptimeMs)}</span>
        </span>
        <span>
          Messages: <span className="text-zinc-200">{stats.messageCount}</span>
        </span>
        <span>
          Reconnects: <span className="text-zinc-200">{stats.reconnectCount}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onChaosMode}
          className="rounded border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-300 transition hover:bg-orange-500/20"
        >
          Enable Chaos Mode
        </button>
        <button
          type="button"
          onClick={onClearChat}
          className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700"
        >
          Clear Chat
        </button>
      </div>
    </div>
  );
}

interface ChaosModeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChaosModeModal({ open, onClose }: ChaosModeModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-zinc-100">Enable Chaos Mode</h3>
        <p className="mb-4 text-sm text-zinc-400">
          Restart the agent-server with chaos mode to test connection drops,
          out-of-order messages, and corrupt heartbeats.
        </p>
        <pre className="mb-4 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-orange-300">
          npm start -- --mode chaos
        </pre>
        <p className="mb-4 text-xs text-zinc-500">
          Run this in the <code className="text-zinc-400">agent-server</code> terminal
          (or use Docker:{" "}
          <code className="text-zinc-400">docker run -p 4747:4747 agent-server --mode chaos</code>
          ).
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-zinc-800 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
