"use client";

import { useState } from "react";
import type { DiffNode } from "../lib/jsonDiff";

function RawTree({ value, level = 0 }: { value: unknown; level?: number }) {
  const isObj = typeof value === "object" && value !== null;
  const [expanded, setExpanded] = useState(level < 1);

  if (!isObj) {
    return <span className="text-emerald-400">{JSON.stringify(value)}</span>;
  }

  const isArray = Array.isArray(value);
  const openBrace = isArray ? "[" : "{";
  const closeBrace = isArray ? "]" : "}";

  return (
    <div className="font-mono text-xs">
      <div
        className="cursor-pointer hover:bg-zinc-800/50 flex items-center select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4 text-zinc-500 text-center shrink-0">{expanded ? "▼" : "▶"}</span>
        <span className="text-zinc-400">{openBrace}</span>
        {!expanded && <span className="text-zinc-500 ml-1">... {closeBrace}</span>}
      </div>

      {expanded && (
        <div className="pl-4 border-l border-zinc-800 ml-2">
          {Object.entries(value as Record<string, unknown>).map(([key, childVal]) => (
            <div key={key} className="flex">
              {!isArray && <span className="text-blue-400 mr-1 shrink-0">"{key}":</span>}
              <div className="flex-1 min-w-0 break-words">
                <RawTree value={childVal} level={level + 1} />
              </div>
            </div>
          ))}
        </div>
      )}
      {expanded && (
        <div className="ml-2">
          <span className="text-zinc-400">{closeBrace}</span>
        </div>
      )}
    </div>
  );
}

export function JsonTree({
  diff,
  level = 0,
}: {
  diff: DiffNode;
  level?: number;
}) {
  const isExpandable = diff.children !== undefined;
  const [expanded, setExpanded] = useState(level < 1);

  let bgColorClass = "";
  if (diff.type === "added") bgColorClass = "bg-emerald-500/20";
  else if (diff.type === "removed")
    bgColorClass = "bg-red-500/20 line-through text-zinc-500";
  else if (diff.type === "changed" && !isExpandable)
    bgColorClass = "bg-yellow-500/20";

  if (!isExpandable) {
    if (diff.type === "changed") {
      return (
        <div className="font-mono text-xs flex flex-wrap gap-2">
          <span className="bg-red-500/20 line-through text-zinc-500 px-1 rounded">
            {JSON.stringify(diff.oldValue)}
          </span>
          <span className="text-zinc-400">→</span>
          <span className="bg-emerald-500/20 px-1 rounded">
            {JSON.stringify(diff.newValue)}
          </span>
        </div>
      );
    }

    const isObj = typeof diff.value === "object" && diff.value !== null;
    return (
      <div className={`${bgColorClass} rounded`}>
        {isObj ? (
          <RawTree value={diff.value} level={level} />
        ) : (
          <span className="font-mono text-xs text-emerald-400 px-1">
            {JSON.stringify(diff.value)}
          </span>
        )}
      </div>
    );
  }

  const isArray = diff.isArray;
  const openBrace = isArray ? "[" : "{";
  const closeBrace = isArray ? "]" : "}";

  const containerClass =
    diff.type === "added"
      ? "bg-emerald-500/10"
      : diff.type === "removed"
        ? "bg-red-500/10"
        : "";

  return (
    <div className={`font-mono text-xs ${containerClass} rounded`}>
      <div
        className="cursor-pointer hover:bg-zinc-800/50 flex items-center select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4 text-zinc-500 text-center shrink-0">{expanded ? "▼" : "▶"}</span>
        <span className="text-zinc-400">{openBrace}</span>
        {!expanded && <span className="text-zinc-500 ml-1">... {closeBrace}</span>}
      </div>

      {expanded && (
        <div className="pl-4 border-l border-zinc-800 ml-2">
          {Object.entries(diff.children || {}).map(([key, childDiff]) => (
            <div key={key} className="flex">
              {!isArray && <span className="text-blue-400 mr-1 shrink-0">"{key}":</span>}
              <div className="flex-1 min-w-0 break-words">
                <JsonTree diff={childDiff} level={level + 1} />
              </div>
            </div>
          ))}
        </div>
      )}
      {expanded && (
        <div className="ml-2">
          <span className="text-zinc-400">{closeBrace}</span>
        </div>
      )}
    </div>
  );
}
