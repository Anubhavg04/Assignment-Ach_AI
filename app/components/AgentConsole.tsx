"use client";

import { useState } from "react";
import { useAgentWebSocket } from "../hooks/useAgentWebSocket";
import { ChatPanel } from "./ChatPanel";
import { ConnectionBannerBar } from "./ConnectionBanner";
import { ContextPanel } from "./ContextPanel";
import { ChaosModeModal, StatsBar } from "./StatsBar";
import { TraceTimeline } from "./TraceTimeline";

export function AgentConsole() {
  const { state, banner, stats, sendUserMessage, setHighlight, clearChat } =
    useAgentWebSocket();
  const [chaosModalOpen, setChaosModalOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-base font-semibold text-zinc-100">Agent Console</h1>
        <p className="text-xs text-zinc-500">
          Phase:{" "}
          <span className="font-mono text-zinc-400">{state.activeStreamPhase}</span>
          {state.seqGapDetected && (
            <span className="ml-2 text-amber-400">· seq gap buffering</span>
          )}
        </p>
      </header>

      <StatsBar
        stats={stats}
        onClearChat={clearChat}
        onChaosMode={() => setChaosModalOpen(true)}
      />

      <ConnectionBannerBar banner={banner} />

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col border-r border-zinc-800">
          <ChatPanel
            messages={state.messages}
            connectionStatus={state.connectionStatus}
            activeStreamPhase={state.activeStreamPhase}
            highlightedId={state.highlightedId}
            onSendMessage={sendUserMessage}
            onHighlight={setHighlight}
          />
        </section>

        <aside className="flex w-[400px] shrink-0 flex-col">
          <div className="min-h-0 flex-1">
            <TraceTimeline
              entries={state.traceEntries}
              highlightedId={state.highlightedId}
              onHighlight={setHighlight}
            />
          </div>
          <ContextPanel
            snapshots={state.contextSnapshots}
            latestContext={state.latestContext}
          />
        </aside>
      </div>

      <ChaosModeModal
        open={chaosModalOpen}
        onClose={() => setChaosModalOpen(false)}
      />
    </div>
  );
}
