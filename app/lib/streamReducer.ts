import type {
  AgentState,
  AssistantChatMessage,
  ContextSnapshot,
  ServerMessage,
  StreamPhase,
  TraceEntry,
  ToolCallSegment,
} from "../types";

export type AgentAction =
  | { type: "SET_CONNECTION"; status: AgentState["connectionStatus"]; attempt?: number }
  | { type: "SET_SEQ_GAP"; gap: boolean; missingSeq?: number }
  | { type: "SET_HIGHLIGHT"; id: string | null }
  | { type: "SEND_USER_MESSAGE"; content: string }
  | { type: "PROCESS_SERVER_MESSAGE"; message: ServerMessage }
  | { type: "RECORD_PONG"; seq: number; echo: string }
  | { type: "CLEAR_CHAT" };

export const initialAgentState: AgentState = {
  connectionStatus: "disconnected",
  reconnectAttempt: 0,
  lastProcessedSeq: 0,
  seqGapDetected: false,
  messages: [],
  traceEntries: [],
  contextSnapshots: [],
  latestContext: null,
  highlightedId: null,
  activeStreamPhase: "idle",
};

export function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "SET_CONNECTION":
      return {
        ...state,
        connectionStatus: action.status,
        reconnectAttempt: action.attempt ?? state.reconnectAttempt,
      };
    case "SET_SEQ_GAP": {
      const next = { ...state, seqGapDetected: action.gap };
      if (action.gap && action.missingSeq !== undefined) {
        const alreadyLogged = state.traceEntries.some(
          (e) => e.kind === "seq_gap" && e.missingSeq === action.missingSeq,
        );
        if (!alreadyLogged) {
          return {
            ...next,
            traceEntries: [
              ...next.traceEntries,
              {
                kind: "seq_gap",
                id: `gap-${action.missingSeq}`,
                missingSeq: action.missingSeq,
                timestamp: Date.now(),
              },
            ],
          };
        }
      }
      return next;
    }
    case "CLEAR_CHAT":
      return {
        ...state,
        messages: [],
        highlightedId: null,
        activeStreamPhase: "idle",
      };
    case "SET_HIGHLIGHT":
      return { ...state, highlightedId: action.id };
    case "SEND_USER_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: `user-${Date.now()}`,
            role: "user",
            content: action.content,
            timestamp: Date.now(),
          },
        ],
        activeStreamPhase: "idle",
      };
    case "RECORD_PONG":
      return {
        ...state,
        traceEntries: [
          ...state.traceEntries,
          {
            kind: "pong",
            id: `pong-${action.seq}-${Date.now()}`,
            seq: action.seq,
            echo: action.echo,
            timestamp: Date.now(),
          },
        ],
      };
    case "PROCESS_SERVER_MESSAGE":
      return reduceServerMessage(state, action.message);
    default:
      return state;
  }
}

function reduceServerMessage(state: AgentState, message: ServerMessage): AgentState {
  const lastProcessedSeq = message.seq;
  let next: AgentState = { ...state, lastProcessedSeq };

  switch (message.type) {
    case "TOKEN":
      next = applyToken(next, message);
      next = appendTokenTrace(next, message);
      break;
    case "TOOL_CALL":
      next = applyToolCall(next, message);
      next.traceEntries = [
        ...next.traceEntries,
        {
          kind: "tool_call",
          id: `trace-tc-${message.call_id}`,
          seq: message.seq,
          callId: message.call_id,
          toolName: message.tool_name,
          args: message.args,
          streamId: message.stream_id,
          highlightId: `tool-${message.call_id}`,
          timestamp: Date.now(),
        },
      ];
      break;
    case "TOOL_RESULT":
      next = applyToolResult(next, message);
      next.traceEntries = [
        ...next.traceEntries,
        {
          kind: "tool_result",
          id: `trace-tr-${message.call_id}`,
          seq: message.seq,
          callId: message.call_id,
          result: message.result,
          streamId: message.stream_id,
          highlightId: `tool-${message.call_id}`,
          timestamp: Date.now(),
        },
      ];
      break;
    case "CONTEXT_SNAPSHOT":
      next = applyContextSnapshot(next, message);
      next.traceEntries = [
        ...next.traceEntries,
        {
          kind: "context",
          id: `trace-ctx-${message.seq}`,
          seq: message.seq,
          contextId: message.context_id,
          timestamp: Date.now(),
        },
      ];
      break;
    case "PING":
      next.traceEntries = [
        ...next.traceEntries,
        {
          kind: "ping",
          id: `trace-ping-${message.seq}`,
          seq: message.seq,
          challenge: message.challenge,
          timestamp: Date.now(),
        },
      ];
      break;
    case "STREAM_END":
      next = applyStreamEnd(next, message.stream_id);
      next.traceEntries = [
        ...next.traceEntries,
        {
          kind: "stream_end",
          id: `trace-end-${message.seq}`,
          seq: message.seq,
          streamId: message.stream_id,
          timestamp: Date.now(),
        },
      ];
      break;
    case "ERROR":
      next.traceEntries = [
        ...next.traceEntries,
        {
          kind: "error",
          id: `trace-err-${message.seq}`,
          seq: message.seq,
          code: message.code,
          message: message.message,
          timestamp: Date.now(),
        },
      ];
      break;
  }

  return next;
}

function applyToken(
  state: AgentState,
  message: Extract<ServerMessage, { type: "TOKEN" }>,
): AgentState {
  const { state: withAssistant, assistant } = ensureAssistant(
    state,
    message.stream_id,
  );
  const segments = [...assistant.segments];
  const last = segments[segments.length - 1];

  if (last?.kind === "text" && last.streamId === message.stream_id) {
    segments[segments.length - 1] = {
      ...last,
      text: last.text + message.text,
    };
  } else {
    segments.push({
      kind: "text",
      id: `text-${message.stream_id}-${segments.length}`,
      text: message.text,
      streamId: message.stream_id,
    });
  }

  return updateAssistant(withAssistant, assistant, segments, "streaming");
}

function applyToolCall(
  state: AgentState,
  message: Extract<ServerMessage, { type: "TOOL_CALL" }>,
): AgentState {
  const { state: withAssistant, assistant } = ensureAssistant(
    state,
    message.stream_id,
  );
  const toolSegment: ToolCallSegment = {
    kind: "tool",
    id: `tool-${message.call_id}`,
    callId: message.call_id,
    toolName: message.tool_name,
    args: message.args,
    status: "running",
    seq: message.seq,
  };

  return updateAssistant(
    withAssistant,
    assistant,
    [...assistant.segments, toolSegment],
    "tool_running",
  );
}

function applyToolResult(
  state: AgentState,
  message: Extract<ServerMessage, { type: "TOOL_RESULT" }>,
): AgentState {
  const assistant = findAssistant(state, message.stream_id);
  if (!assistant) {
    return state;
  }

  const segments = assistant.segments.map((seg) =>
    seg.kind === "tool" && seg.callId === message.call_id
      ? { ...seg, result: message.result, status: "complete" as const }
      : seg,
  );

  segments.push({
    kind: "text",
    id: `text-${message.stream_id}-${segments.length}`,
    text: "",
    streamId: message.stream_id,
  });

  return updateAssistant(state, assistant, segments, "streaming");
}

function applyStreamEnd(state: AgentState, streamId: string): AgentState {
  const assistant = findAssistant(state, streamId);
  if (!assistant) {
    return { ...state, activeStreamPhase: "complete" };
  }

  return updateAssistant(state, assistant, assistant.segments, "complete");
}

function applyContextSnapshot(
  state: AgentState,
  message: Extract<ServerMessage, { type: "CONTEXT_SNAPSHOT" }>,
): AgentState {
  const snapshot: ContextSnapshot = {
    contextId: message.context_id,
    data: message.data,
    seq: message.seq,
    timestamp: Date.now(),
  };

  return {
    ...state,
    contextSnapshots: [...state.contextSnapshots, snapshot],
    latestContext: snapshot,
  };
}

function appendTokenTrace(
  state: AgentState,
  message: Extract<ServerMessage, { type: "TOKEN" }>,
): AgentState {
  const now = Date.now();
  const entries = state.traceEntries;
  const last = entries[entries.length - 1];
  const assistant = findAssistant(state, message.stream_id);
  const textSegment = assistant?.segments
    .slice()
    .reverse()
    .find((s) => s.kind === "text");
  const highlightId = textSegment?.id ?? `text-${message.stream_id}-0`;

  if (last?.kind === "token_batch" && last.streamId === message.stream_id) {
    const updated: TraceEntry = {
      ...last,
      seqEnd: message.seq,
      tokenCount: last.tokenCount + 1,
      durationMs: now - last.timestamp,
      fullText: last.fullText + message.text,
    };
    return {
      ...state,
      traceEntries: [...entries.slice(0, -1), updated],
    };
  }

  return {
    ...state,
    traceEntries: [
      ...entries,
      {
        kind: "token_batch",
        id: `batch-${message.stream_id}-${message.seq}`,
        streamId: message.stream_id,
        seqStart: message.seq,
        seqEnd: message.seq,
        tokenCount: 1,
        durationMs: 0,
        fullText: message.text,
        highlightId,
        timestamp: now,
      },
    ],
  };
}

function ensureAssistant(
  state: AgentState,
  streamId: string,
): { state: AgentState; assistant: AssistantChatMessage } {
  const existing = findAssistant(state, streamId);
  if (existing) {
    return { state, assistant: existing };
  }

  const assistant: AssistantChatMessage = {
    id: `assistant-${streamId}`,
    role: "assistant",
    streamId,
    segments: [],
    phase: "idle",
    timestamp: Date.now(),
  };

  return {
    state: { ...state, messages: [...state.messages, assistant] },
    assistant,
  };
}

function findAssistant(
  state: AgentState,
  streamId: string,
): AssistantChatMessage | undefined {
  return state.messages.find(
    (m): m is AssistantChatMessage =>
      m.role === "assistant" && m.streamId === streamId,
  );
}

function updateAssistant(
  state: AgentState,
  assistant: AssistantChatMessage,
  segments: AssistantChatMessage["segments"],
  phase: StreamPhase,
): AgentState {
  const updated: AssistantChatMessage = { ...assistant, segments, phase };
  return {
    ...state,
    messages: state.messages.map((m) =>
      m.id === assistant.id ? updated : m,
    ),
    activeStreamPhase: phase,
  };
}
