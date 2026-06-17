"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type {
  AssistantChatMessage,
  ChatMessage,
  ConnectionStatus,
  MessageSegment,
} from "../types";

interface ChatPanelProps {
  messages: ChatMessage[];
  connectionStatus: ConnectionStatus;
  activeStreamPhase: string;
  highlightedId: string | null;
  onSendMessage: (content: string) => void;
  onHighlight: (id: string | null) => void;
}

export function ChatPanel({
  messages,
  connectionStatus,
  activeStreamPhase,
  highlightedId,
  onSendMessage,
  onHighlight,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeStreamPhase]);

  useEffect(() => {
    if (!highlightedId) {
      return;
    }
    const el = segmentRefs.current.get(highlightedId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }
    onSendMessage(input);
    setInput("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (input.trim()) {
        onSendMessage(input);
        setInput("");
      }
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Send a message to start — try &quot;hello&quot; or &quot;summarize the Q3 report&quot;
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) =>
              message.role === "user" ? (
                <UserBubble key={message.id} content={message.content} />
              ) : (
                <AssistantBubble
                  key={message.id}
                  message={message}
                  highlightedId={highlightedId}
                  segmentRefs={segmentRefs}
                  onHighlight={onHighlight}
                />
              ),
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-800 bg-zinc-900/50 p-4"
      >
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || connectionStatus !== "connected"}
            className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function TypingIndicator({ compact = false }: { compact?: boolean }) {
  const dots = (
    <>
      <span className="typing-dot h-2 w-2 rounded-full bg-zinc-400" />
      <span className="typing-dot typing-dot-delay-1 h-2 w-2 rounded-full bg-zinc-400" />
      <span className="typing-dot typing-dot-delay-2 h-2 w-2 rounded-full bg-zinc-400" />
    </>
  );

  if (compact) {
    return <span className="inline-flex items-center gap-1">{dots}</span>;
  }

  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 px-4 py-3">
      {dots}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2 text-sm text-white">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  highlightedId,
  segmentRefs,
  onHighlight,
}: {
  message: AssistantChatMessage;
  highlightedId: string | null;
  segmentRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onHighlight: (id: string | null) => void;
}) {
  const showWaitingCursor =
    message.phase === "streaming" &&
    message.segments.length === 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100">
        {showWaitingCursor ? (
          <TypingIndicator />
        ) : (
          <>
            {message.segments.map((segment) => (
              <SegmentBlock
                key={segment.id}
                segment={segment}
                highlighted={highlightedId === segment.id}
                setRef={(el) => {
                  if (el) {
                    segmentRefs.current.set(segment.id, el);
                  } else {
                    segmentRefs.current.delete(segment.id);
                  }
                }}
                onClick={() => onHighlight(segment.id)}
              />
            ))}
            {message.phase === "streaming" && (
              <span className="ml-1 inline-flex align-middle">
                <TypingIndicator compact />
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SegmentBlock({
  segment,
  highlighted,
  setRef,
  onClick,
}: {
  segment: MessageSegment;
  highlighted: boolean;
  setRef: (el: HTMLDivElement | null) => void;
  onClick: () => void;
}) {
  if (segment.kind === "text") {
    if (!segment.text) {
      return null;
    }
    return (
      <div
        ref={setRef}
        onClick={onClick}
        className={`inline whitespace-pre-wrap transition ${
          highlighted ? "rounded bg-blue-500/20 ring-2 ring-blue-500/50" : ""
        }`}
      >
        {segment.text}
      </div>
    );
  }

  const isRunning = segment.status === "running";

  return (
    <div className="relative my-3 ml-1 pl-4">
      <div
        className={`absolute bottom-0 left-0 top-0 w-0.5 rounded-full ${
          isRunning ? "bg-amber-500/60" : "bg-emerald-500/60"
        }`}
      />
      <div
        ref={setRef}
        onClick={onClick}
        className={`rounded-lg border p-3 transition ${
          isRunning
            ? "border-amber-500/40 bg-amber-500/10"
            : "border-emerald-500/40 bg-emerald-500/10"
        } ${highlighted ? "ring-2 ring-blue-500/50" : ""}`}
      >
        <div className="mb-2 flex items-center gap-2 text-xs font-medium">
          {isRunning ? (
            <>
              <Spinner />
              <span className="text-amber-200">
                🔧 Calling: {segment.toolName}…
              </span>
            </>
          ) : (
            <span className="text-emerald-200">
              ✅ {segment.toolName}
            </span>
          )}
        </div>
        <pre className="mb-2 overflow-x-auto rounded bg-black/30 p-2 font-mono text-xs text-zinc-300">
          {JSON.stringify(segment.args, null, 2)}
        </pre>
        {segment.result && (
          <div>
            <p className="mb-1 text-xs text-emerald-300">Result:</p>
            <pre className="overflow-x-auto rounded bg-black/30 p-2 font-mono text-xs text-zinc-300">
              {JSON.stringify(segment.result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400"
      aria-hidden
    />
  );
}
