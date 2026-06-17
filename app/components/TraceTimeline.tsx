"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "../lib/format";
import type { TraceEntry, TraceFilterType } from "../types";

interface TraceTimelineProps {
  entries: TraceEntry[];
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
}

type EventBadgeKind =
  | "TOKEN"
  | "TOOL_CALL"
  | "TOOL_RESULT"
  | "PING"
  | "PONG"
  | "GAP WARNING"
  | "ERROR"
  | "CONTEXT"
  | "STREAM_END";

interface RenderGroup {
  entries: TraceEntry[];
  isToolGroup: boolean;
}

const BADGE_STYLES: Record<EventBadgeKind, string> = {
  TOKEN: "bg-blue-500/25 text-blue-200 ring-blue-500/30",
  TOOL_CALL: "bg-yellow-500/25 text-yellow-100 ring-yellow-500/30",
  TOOL_RESULT: "bg-emerald-500/25 text-emerald-100 ring-emerald-500/30",
  PING: "bg-zinc-600/40 text-zinc-300 ring-zinc-500/30",
  PONG: "bg-zinc-600/40 text-zinc-300 ring-zinc-500/30",
  "GAP WARNING": "bg-orange-500/30 text-orange-100 ring-orange-500/40",
  ERROR: "bg-red-500/25 text-red-200 ring-red-500/30",
  CONTEXT: "bg-purple-500/20 text-purple-200 ring-purple-500/30",
  STREAM_END: "bg-zinc-700/40 text-zinc-300 ring-zinc-600/30",
};

export function TraceTimeline({
  entries,
  highlightedId,
  onHighlight,
}: TraceTimelineProps) {
  const [filter, setFilter] = useState<TraceFilterType>("all");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return entries.filter((entry) => {
      if (filter !== "all" && !matchesFilter(entry, filter)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return getSearchText(entry).toLowerCase().includes(query);
    });
  }, [entries, filter, search]);

  const renderGroups = useMemo(() => groupEntries(filtered), [filtered]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filtered.length]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRowClick = (entry: TraceEntry) => {
    if (entry.kind === "token_batch") {
      toggleExpand(entry.id);
    }
    onHighlight(getHighlightId(entry));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-900">
      <header className="shrink-0 border-b border-zinc-800 px-3 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Agent Trace</h2>
        <p className="text-xs text-zinc-500">{entries.length} events</p>
      </header>

      <div className="shrink-0 space-y-2 border-b border-zinc-800 p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events…"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded px-2 py-0.5 text-xs transition ${
                filter === option.value
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-zinc-500">No events yet</p>
        ) : (
          <div className="divide-y divide-zinc-800">
            {renderGroups.map((group) => {
              if (group.entries.length === 1 && group.entries[0].kind === "seq_gap") {
                return (
                  <GapBanner
                    key={group.entries[0].id}
                    entry={group.entries[0]}
                  />
                );
              }

              if (group.isToolGroup) {
                return (
                  <div
                    key={`tool-group-${group.entries[0].id}`}
                    className="border-l-2 border-yellow-500/50 ml-3"
                  >
                    {group.entries.map((entry) => (
                      <TraceRow
                        key={entry.id}
                        entry={entry}
                        expanded={expandedIds.has(entry.id)}
                        highlighted={
                          getHighlightId(entry) !== null &&
                          highlightedId === getHighlightId(entry)
                        }
                        inToolGroup
                        onClick={() => handleRowClick(entry)}
                      />
                    ))}
                  </div>
                );
              }

              return group.entries.map((entry) => (
                <TraceRow
                  key={entry.id}
                  entry={entry}
                  expanded={expandedIds.has(entry.id)}
                  highlighted={
                    getHighlightId(entry) !== null &&
                    highlightedId === getHighlightId(entry)
                  }
                  onClick={() => handleRowClick(entry)}
                />
              ));
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function groupEntries(entries: TraceEntry[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  let i = 0;

  while (i < entries.length) {
    const entry = entries[i];

    if (entry.kind === "seq_gap") {
      groups.push({ entries: [entry], isToolGroup: false });
      i += 1;
      continue;
    }

    if (entry.kind === "tool_call") {
      const next = entries[i + 1];
      if (
        next?.kind === "tool_result" &&
        next.callId === entry.callId
      ) {
        groups.push({ entries: [entry, next], isToolGroup: true });
        i += 2;
        continue;
      }
    }

    groups.push({ entries: [entry], isToolGroup: false });
    i += 1;
  }

  return groups;
}

function GapBanner({ entry }: { entry: Extract<TraceEntry, { kind: "seq_gap" }> }) {
  return (
    <div className="bg-orange-500/20 px-4 py-3 text-sm text-orange-100 ring-1 ring-inset ring-orange-500/30">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-orange-200/70">
          {formatTime(entry.timestamp)}
        </span>
        <EventBadge kind="GAP WARNING" />
        <span className="font-mono text-xs text-orange-200/80">
          #{entry.missingSeq}
        </span>
      </div>
      <p className="mt-1 pl-0 text-sm text-orange-100">
        ⚠️ Gap detected: missing seq #{entry.missingSeq} — buffering out-of-order events
      </p>
    </div>
  );
}

function EventBadge({ kind }: { kind: EventBadgeKind }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-sm font-bold ring-1 ring-inset ${BADGE_STYLES[kind]}`}
    >
      {kind}
    </span>
  );
}

function getEventBadgeKind(entry: TraceEntry): EventBadgeKind {
  switch (entry.kind) {
    case "token_batch":
      return "TOKEN";
    case "tool_call":
      return "TOOL_CALL";
    case "tool_result":
      return "TOOL_RESULT";
    case "ping":
      return "PING";
    case "pong":
      return "PONG";
    case "seq_gap":
      return "GAP WARNING";
    case "error":
      return "ERROR";
    case "context":
      return "CONTEXT";
    case "stream_end":
      return "STREAM_END";
  }
}

function getEventId(entry: TraceEntry): string {
  if (entry.kind === "token_batch") {
    return entry.seqStart === entry.seqEnd
      ? `#${entry.seqStart}`
      : `#${entry.seqStart}-${entry.seqEnd}`;
  }
  if (entry.kind === "seq_gap") {
    return `#${entry.missingSeq}`;
  }
  if (entry.kind === "tool_call" || entry.kind === "tool_result") {
    return entry.callId;
  }
  if (entry.kind === "context") {
    return entry.contextId;
  }
  if (entry.kind === "stream_end") {
    return entry.streamId;
  }
  return `#${entry.seq}`;
}

function getDescription(entry: TraceEntry, expanded: boolean): string {
  switch (entry.kind) {
    case "token_batch": {
      const summary = `Streamed ${entry.tokenCount} token${entry.tokenCount !== 1 ? "s" : ""} · ${(entry.durationMs / 1000).toFixed(1)}s`;
      if (expanded) {
        return summary;
      }
      const preview = entry.fullText.slice(0, 80);
      return preview.length < entry.fullText.length
        ? `${summary} — "${preview}…"`
        : `${summary} — "${preview}"`;
    }
    case "tool_call":
      return `${entry.toolName}(${summarizeObject(entry.args)})`;
    case "tool_result":
      return summarizeObject(entry.result);
    case "context":
      return `Context snapshot received`;
    case "ping":
      return entry.challenge
        ? `challenge: ${entry.challenge}`
        : "Empty challenge (corrupt heartbeat)";
    case "pong":
      return `echo: ${entry.echo}`;
    case "stream_end":
      return `Stream completed · ${entry.streamId}`;
    case "error":
      return `[${entry.code}] ${entry.message}`;
    case "seq_gap":
      return `Missing seq #${entry.missingSeq}`;
  }
}

function summarizeObject(value: Record<string, unknown>): string {
  const text = JSON.stringify(value);
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function getHighlightId(entry: TraceEntry): string | null {
  if (
    entry.kind === "token_batch" ||
    entry.kind === "tool_call" ||
    entry.kind === "tool_result"
  ) {
    return entry.highlightId;
  }
  return null;
}

const FILTER_OPTIONS: { value: TraceFilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "TOKEN", label: "Tokens" },
  { value: "TOOL", label: "Tools" },
  { value: "CONTEXT", label: "Context" },
  { value: "HEARTBEAT", label: "Heartbeat" },
  { value: "ERROR", label: "Errors" },
];

function matchesFilter(entry: TraceEntry, filter: TraceFilterType): boolean {
  switch (filter) {
    case "TOKEN":
      return entry.kind === "token_batch";
    case "TOOL":
      return entry.kind === "tool_call" || entry.kind === "tool_result";
    case "CONTEXT":
      return entry.kind === "context";
    case "HEARTBEAT":
      return entry.kind === "ping" || entry.kind === "pong";
    case "ERROR":
      return entry.kind === "error" || entry.kind === "seq_gap";
    default:
      return true;
  }
}

function getSearchText(entry: TraceEntry): string {
  switch (entry.kind) {
    case "token_batch":
      return entry.fullText;
    case "tool_call":
      return `${entry.toolName} ${JSON.stringify(entry.args)}`;
    case "tool_result":
      return JSON.stringify(entry.result);
    case "context":
      return entry.contextId;
    case "ping":
      return entry.challenge;
    case "pong":
      return entry.echo;
    case "stream_end":
      return entry.streamId;
    case "error":
      return `${entry.code} ${entry.message}`;
    case "seq_gap":
      return `gap missing seq ${entry.missingSeq}`;
  }
}

function TraceRow({
  entry,
  expanded,
  highlighted,
  inToolGroup = false,
  onClick,
}: {
  entry: TraceEntry;
  expanded: boolean;
  highlighted: boolean;
  inToolGroup?: boolean;
  onClick: () => void;
}) {
  const badgeKind = getEventBadgeKind(entry);
  const description = getDescription(entry, expanded);

  return (
    <div
      className={`transition ${
        highlighted ? "bg-blue-500/10 ring-1 ring-inset ring-blue-500/40" : "hover:bg-zinc-800/40"
      } ${inToolGroup ? "pl-3" : ""}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full px-4 py-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 font-mono text-xs text-zinc-500">
            {formatTime(entry.timestamp)}
          </span>
          <EventBadge kind={badgeKind} />
          <span className="font-mono text-xs text-zinc-400">{getEventId(entry)}</span>
          {entry.kind === "token_batch" && (
            <span className="ml-auto text-xs text-zinc-500">{expanded ? "▼" : "▶"}</span>
          )}
        </div>
        <p className="mt-1.5 pl-1 text-sm text-zinc-300">{description}</p>
      </button>

      {entry.kind === "token_batch" && expanded && (
        <pre className="mx-4 mb-3 max-h-40 overflow-auto rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 font-mono text-xs text-blue-200/90">
          {entry.fullText}
        </pre>
      )}

      {(entry.kind === "tool_call" || entry.kind === "tool_result") && (
        <pre className="mx-4 mb-3 max-h-32 overflow-auto rounded-md border border-zinc-700/50 bg-zinc-950/60 px-3 py-2 font-mono text-xs text-zinc-400">
          {entry.kind === "tool_call"
            ? JSON.stringify(entry.args, null, 2)
            : JSON.stringify(entry.result, null, 2)}
        </pre>
      )}
    </div>
  );
}
