"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContextSnapshot } from "../types";
import { computeJsonDiff } from "../lib/jsonDiff";
import { JsonTree } from "./JsonTree";

interface ContextPanelProps {
  snapshots: ContextSnapshot[];
  latestContext: ContextSnapshot | null;
}

export function ContextPanel({ snapshots, latestContext }: ContextPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Filter snapshots to the currently active contextId
  const activeSnapshots = useMemo(() => {
    if (!latestContext) return [];
    return snapshots.filter((s) => s.contextId === latestContext.contextId);
  }, [snapshots, latestContext]);

  // Reset history index if contextId changes
  useEffect(() => {
    setHistoryIndex(-1);
  }, [latestContext?.contextId]);

  // Keep scrubber pinned to the latest snapshot as new ones arrive, unless the user manually stepped back
  useEffect(() => {
    setHistoryIndex((prev) => {
      // If we were at the end (or uninitialized), stick to the end
      if (prev === -1 || prev === activeSnapshots.length - 2) {
        return activeSnapshots.length - 1;
      }
      return prev;
    });
  }, [activeSnapshots.length]);

  const currentIndex = historyIndex === -1 ? Math.max(0, activeSnapshots.length - 1) : historyIndex;
  const currentSnapshot = activeSnapshots[currentIndex] || latestContext;
  const previousSnapshot = currentIndex > 0 ? activeSnapshots[currentIndex - 1] : null;

  const diff = useMemo(() => {
    if (!currentSnapshot) return null;
    return computeJsonDiff(previousSnapshot?.data, currentSnapshot.data);
  }, [currentSnapshot, previousSnapshot]);

  const handlePrev = () => {
    if (currentIndex > 0) setHistoryIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < activeSnapshots.length - 1) setHistoryIndex(currentIndex + 1);
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 flex flex-col shrink-0 min-h-0 flex-1">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex shrink-0 w-full items-center justify-between px-4 py-2 text-left hover:bg-zinc-900/80"
      >
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Context Snapshot</h2>
          <p className="text-xs text-zinc-500">
            {snapshots.length} total snapshot{snapshots.length !== 1 ? "s" : ""} received
          </p>
        </div>
        <span className="text-zinc-500">{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <div className="flex-1 min-h-0 flex flex-col border-t border-zinc-800">
          {!currentSnapshot ? (
            <div className="px-4 py-3 text-xs text-zinc-500">
              No context snapshot yet. Try &quot;summarize the Q3 report&quot;.
            </div>
          ) : (
            <>
              {activeSnapshots.length > 1 && (
                <div className="flex shrink-0 items-center justify-between bg-zinc-900/50 px-4 py-2 border-b border-zinc-800">
                  <span className="text-xs text-zinc-400">
                    Step {currentIndex + 1} of {activeSnapshots.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &larr; Prev
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={currentIndex === activeSnapshots.length - 1}
                      className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
              
              <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-2 text-xs text-zinc-500 border-b border-zinc-800">
                <span className="font-mono">seq #{currentSnapshot.seq}</span>
                <span>·</span>
                <span className="font-mono">{currentSnapshot.contextId}</span>
              </div>
              
              <div className="flex-1 min-h-0 overflow-auto p-4 bg-zinc-900">
                {diff && <JsonTree diff={diff} />}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
