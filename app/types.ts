// Protocol types aligned with agent-server canonical protocol

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting";

export type StreamPhase =
  | "idle"
  | "streaming"
  | "tool_running"
  | "complete";

// ── Server → Client ───────────────────────────────────────────

export interface TokenMessage {
  type: "TOKEN";
  seq: number;
  text: string;
  stream_id: string;
}

export interface ToolCallMessage {
  type: "TOOL_CALL";
  seq: number;
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  stream_id: string;
}

export interface ToolResultMessage {
  type: "TOOL_RESULT";
  seq: number;
  call_id: string;
  result: Record<string, unknown>;
  stream_id: string;
}

export interface ContextSnapshotMessage {
  type: "CONTEXT_SNAPSHOT";
  seq: number;
  context_id: string;
  data: Record<string, unknown>;
}

export interface PingMessage {
  type: "PING";
  seq: number;
  challenge: string;
}

export interface StreamEndMessage {
  type: "STREAM_END";
  seq: number;
  stream_id: string;
}

export interface ErrorMessage {
  type: "ERROR";
  seq: number;
  code: string;
  message: string;
}

export type ServerMessage =
  | TokenMessage
  | ToolCallMessage
  | ToolResultMessage
  | ContextSnapshotMessage
  | PingMessage
  | StreamEndMessage
  | ErrorMessage;

// ── Client → Server ─────────────────────────────────────────

export interface UserMessagePayload {
  type: "USER_MESSAGE";
  content: string;
}

export interface PongPayload {
  type: "PONG";
  echo: string;
}

export interface ResumePayload {
  type: "RESUME";
  last_seq: number;
}

export interface ToolAckPayload {
  type: "TOOL_ACK";
  call_id: string;
}

export type ClientMessage =
  | UserMessagePayload
  | PongPayload
  | ResumePayload
  | ToolAckPayload;

// ── UI State ──────────────────────────────────────────────────

export interface ToolCallSegment {
  kind: "tool";
  id: string;
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "running" | "complete";
  seq: number;
}

export interface TextSegment {
  kind: "text";
  id: string;
  text: string;
  streamId: string;
}

export type MessageSegment = TextSegment | ToolCallSegment;

export interface UserChatMessage {
  id: string;
  role: "user";
  content: string;
  timestamp: number;
}

export interface AssistantChatMessage {
  id: string;
  role: "assistant";
  streamId: string;
  segments: MessageSegment[];
  phase: StreamPhase;
  timestamp: number;
}

export type ChatMessage = UserChatMessage | AssistantChatMessage;

export interface ContextSnapshot {
  contextId: string;
  data: Record<string, unknown>;
  seq: number;
  timestamp: number;
}

export interface TokenBatchTrace {
  kind: "token_batch";
  id: string;
  streamId: string;
  seqStart: number;
  seqEnd: number;
  tokenCount: number;
  durationMs: number;
  fullText: string;
  highlightId: string;
  timestamp: number;
}

export interface ToolCallTrace {
  kind: "tool_call";
  id: string;
  seq: number;
  callId: string;
  toolName: string;
  args: Record<string, unknown>;
  streamId: string;
  highlightId: string;
  timestamp: number;
}

export interface ToolResultTrace {
  kind: "tool_result";
  id: string;
  seq: number;
  callId: string;
  result: Record<string, unknown>;
  streamId: string;
  highlightId: string;
  timestamp: number;
}

export interface ContextTrace {
  kind: "context";
  id: string;
  seq: number;
  contextId: string;
  timestamp: number;
}

export interface PingTrace {
  kind: "ping";
  id: string;
  seq: number;
  challenge: string;
  timestamp: number;
}

export interface PongTrace {
  kind: "pong";
  id: string;
  seq: number;
  echo: string;
  timestamp: number;
}

export interface StreamEndTrace {
  kind: "stream_end";
  id: string;
  seq: number;
  streamId: string;
  timestamp: number;
}

export interface ErrorTrace {
  kind: "error";
  id: string;
  seq: number;
  code: string;
  message: string;
  timestamp: number;
}

export interface GapTrace {
  kind: "seq_gap";
  id: string;
  missingSeq: number;
  timestamp: number;
}

export type TraceEntry =
  | TokenBatchTrace
  | ToolCallTrace
  | ToolResultTrace
  | ContextTrace
  | PingTrace
  | PongTrace
  | StreamEndTrace
  | ErrorTrace
  | GapTrace;

export type ConnectionBanner =
  | { kind: "disconnected"; attempt: number; maxAttempts: number }
  | { kind: "reconnected"; resumeSeq: number }
  | null;

export type TraceFilterType =
  | "all"
  | "TOKEN"
  | "TOOL"
  | "CONTEXT"
  | "HEARTBEAT"
  | "ERROR";

export interface AgentState {
  connectionStatus: ConnectionStatus;
  reconnectAttempt: number;
  lastProcessedSeq: number;
  seqGapDetected: boolean;
  messages: ChatMessage[];
  traceEntries: TraceEntry[];
  contextSnapshots: ContextSnapshot[];
  latestContext: ContextSnapshot | null;
  highlightedId: string | null;
  activeStreamPhase: StreamPhase;
}

export const WS_URL = "ws://localhost:4747/ws";
