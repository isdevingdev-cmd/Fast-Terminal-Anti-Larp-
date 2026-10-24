"use client";
/**
 * Live pump.fun feed over a plain Solana JSON-RPC WebSocket (`logsSubscribe`).
 * No third-party data vendor: we decode the program's anchor events ourselves.
 *
 * Events are buffered and flushed to the store every FLUSH_MS to keep React cheap
 * even when the program emits hundreds of events per second.
 */
import { RPC_WS_URL } from "../config";
import { PUMP_PROGRAM_ID } from "../pump/constants";
import { decodeLogs } from "../pump/decoder";
import type { PumpEvent } from "../pump/types";
import { useTokenStore } from "../store/tokens";

const FLUSH_MS = 120;

interface LogsNotification {
  method: "logsNotification";
  params: {
    subscription: number;
    result: {
      context: { slot: number };
      value: { signature: string; err: unknown; logs: string[] };
    };
  };
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let buffer: PumpEvent[] = [];
let backoff = 1000;
let eventCounter = 0;
let started = false;

function flush() {
  const store = useTokenStore.getState();
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  if (store.paused) {
    // keep trades flowing (prices), but drop creates while paused so the New column stands still
    store.applyEvents(batch.filter((e) => e.kind !== "create"));
    return;
  }
  store.applyEvents(batch);
}

function connect() {
  const store = useTokenStore.getState();
  store.setFeedStatus("connecting");
  try {
    ws = new WebSocket(RPC_WS_URL);
  } catch (e) {
    console.error("[feed] ws error", e);
    store.setFeedStatus("error");
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    backoff = 1000;
    store.setFeedStatus("live");
    ws?.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "logsSubscribe",
        params: [{ mentions: [PUMP_PROGRAM_ID] }, { commitment: "processed" }],
      }),
    );
  };

  ws.onmessage = (msg) => {
    let data: LogsNotification | { id: number; result: number };
    try {
      data = JSON.parse(typeof msg.data === "string" ? msg.data : "");
    } catch {
      return;
    }
    if (!("method" in data) || data.method !== "logsNotification") return;
    const { value, context } = data.params.result;
    if (value.err) return; // failed tx
    const events = decodeLogs(value.logs, { signature: value.signature, slot: context.slot });
    if (events.length) {
      eventCounter += events.length;
      buffer.push(...events);
    }
  };

  ws.onclose = () => {
    store.setFeedStatus("error");
    scheduleReconnect();
  };
  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect() {
  if (!started) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    backoff = Math.min(backoff * 2, 15_000);
    connect();
  }, backoff);
}

let epsTimer: ReturnType<typeof setInterval> | null = null;

export function startPumpFeed() {
  if (started || typeof window === "undefined") return;
  started = true;
  connect();
  flushTimer = setInterval(flush, FLUSH_MS);
  epsTimer = setInterval(() => {
    useTokenStore.setState({ eventsPerSec: eventCounter });
    eventCounter = 0;
  }, 1000);
}

export function stopPumpFeed() {
  started = false;
  if (flushTimer) clearInterval(flushTimer);
  if (epsTimer) clearInterval(epsTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
  useTokenStore.getState().setFeedStatus("idle");
}
