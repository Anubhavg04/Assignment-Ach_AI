"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { SeqBuffer } from "../lib/seqBuffer";
import {
  agentReducer,
  initialAgentState,
} from "../lib/streamReducer";
import type { AgentState, ClientMessage, ConnectionBanner, ServerMessage } from "../types";

const WS_ENDPOINT = "ws://localhost:4747/ws";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECTED_BANNER_MS = 3000;

function getBackoffMs(attempt: number): number {
  const base = 500 * Math.pow(2, attempt);
  return Math.min(base, 10000);
}

export interface SessionStats {
  lastSeq: number;
  uptimeMs: number;
  messageCount: number;
  reconnectCount: number;
}

export interface UseAgentWebSocketReturn {
  state: AgentState;
  banner: ConnectionBanner;
  stats: SessionStats;
  sendUserMessage: (content: string) => void;
  setHighlight: (id: string | null) => void;
  clearChat: () => void;
}

export function useAgentWebSocket(): UseAgentWebSocketReturn {
  const [state, dispatch] = useReducer(agentReducer, initialAgentState);
  const [banner, setBanner] = useState<ConnectionBanner>(null);
  const [uptimeMs, setUptimeMs] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  const sessionStartRef = useRef(Date.now());
  const seqBufferRef = useRef(new SeqBuffer());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const mountedRef = useRef(true);
  const hasConnectedOnceRef = useRef(false);

  const dispatchSeqGap = useCallback(() => {
    const gap = seqBufferRef.current.hasGap();
    const missingSeq = seqBufferRef.current.getMissingSeq();
    dispatch({
      type: "SET_SEQ_GAP",
      gap,
      missingSeq: missingSeq ?? undefined,
    });
  }, []);

  const sendRaw = useCallback((message: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  const processMessages = useCallback(
    (messages: ServerMessage[]) => {
      for (const message of messages) {
        if (message.type === "PING") {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            sendRaw({ type: "PONG", echo: message.challenge });
          }
          dispatch({
            type: "RECORD_PONG",
            seq: message.seq,
            echo: message.challenge ?? "<corrupt/missing>",
          });
        }

        if (message.type === "TOOL_CALL") {
          sendRaw({ type: "TOOL_ACK", call_id: message.call_id });
        }

        dispatch({ type: "PROCESS_SERVER_MESSAGE", message });
      }

      dispatchSeqGap();
    },
    [dispatchSeqGap, sendRaw],
  );

  const handleIncoming = useCallback(
    (raw: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      const messages = seqBufferRef.current.enqueue(parsed);
      if (messages.length > 0) {
        processMessages(messages);
      } else {
        dispatchSeqGap();
      }
    },
    [dispatchSeqGap, processMessages],
  );

  const connectRef = useRef<() => void>(() => {});

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    const attempt = reconnectAttemptRef.current;
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      setBanner({
        kind: "disconnected",
        attempt: MAX_RECONNECT_ATTEMPTS,
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
      });
      return;
    }

    const delay = getBackoffMs(attempt);
    reconnectAttemptRef.current = attempt + 1;
    setReconnectCount((c) => c + 1);

    setBanner({
      kind: "disconnected",
      attempt: reconnectAttemptRef.current,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
    });

    dispatch({
      type: "SET_CONNECTION",
      status: "reconnecting",
      attempt: reconnectAttemptRef.current,
    });

    reconnectTimerRef.current = setTimeout(() => {
      connectRef.current();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (hasConnectedOnceRef.current) {
      dispatch({
        type: "SET_CONNECTION",
        status: "reconnecting",
        attempt: reconnectAttemptRef.current,
      });
    }

    const ws = new WebSocket(WS_ENDPOINT);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) {
        return;
      }

      const lastSeq = seqBufferRef.current.getLastProcessedSeq();
      const isReconnect = hasConnectedOnceRef.current;
      hasConnectedOnceRef.current = true;
      reconnectAttemptRef.current = 0;

      dispatch({ type: "SET_CONNECTION", status: "connected", attempt: 0 });

      if (lastSeq > 0) {
        sendRaw({ type: "RESUME", last_seq: lastSeq });
      }

      if (isReconnect) {
        setBanner({ kind: "reconnected", resumeSeq: lastSeq });
        if (bannerTimerRef.current) {
          clearTimeout(bannerTimerRef.current);
        }
        bannerTimerRef.current = setTimeout(() => {
          setBanner(null);
        }, RECONNECTED_BANNER_MS);
      } else {
        setBanner(null);
      }
    };

    ws.onmessage = (event) => {
      handleIncoming(String(event.data));
    };

    ws.onclose = (event) => {
      if (!mountedRef.current || intentionalCloseRef.current || wsRef.current !== ws) {
        return;
      }

      dispatch({ type: "SET_CONNECTION", status: "disconnected" });

      if (event.code === 1000 && event.reason === "replaced") {
        return;
      }

      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [handleIncoming, scheduleReconnect, sendRaw]);

  connectRef.current = connect;

  useEffect(() => {
    mountedRef.current = true;
    intentionalCloseRef.current = false;
    connect();

    const uptimeInterval = setInterval(() => {
      setUptimeMs(Date.now() - sessionStartRef.current);
    }, 1000);

    return () => {
      mountedRef.current = false;
      intentionalCloseRef.current = true;
      clearInterval(uptimeInterval);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const sendUserMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      dispatch({ type: "SEND_USER_MESSAGE", content: trimmed });
      sendRaw({ type: "USER_MESSAGE", content: trimmed });
    },
    [sendRaw],
  );

  const setHighlight = useCallback((id: string | null) => {
    dispatch({ type: "SET_HIGHLIGHT", id });
  }, []);

  const clearChat = useCallback(() => {
    dispatch({ type: "CLEAR_CHAT" });
  }, []);

  const messageCount = state.messages.length;

  return {
    state,
    banner,
    stats: {
      lastSeq: state.lastProcessedSeq,
      uptimeMs,
      messageCount,
      reconnectCount,
    },
    sendUserMessage,
    setHighlight,
    clearChat,
  };
}
