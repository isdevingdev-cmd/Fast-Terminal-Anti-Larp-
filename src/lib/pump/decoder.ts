import { encodeBase58 } from "../base58";
import { EVENT_DISCRIMINATORS } from "./constants";
import type { PumpCompleteEvent, PumpCreateEvent, PumpEvent, PumpTradeEvent } from "./types";

/** Tiny Borsh-style reader (little-endian). */
class Reader {
  private off = 0;
  private readonly view: DataView;
  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  get remaining() {
    return this.buf.length - this.off;
  }
  u8(): number {
    const v = this.view.getUint8(this.off);
    this.off += 1;
    return v;
  }
  u32(): number {
    const v = this.view.getUint32(this.off, true);
    this.off += 4;
    return v;
  }
  u64(): bigint {
    const v = this.view.getBigUint64(this.off, true);
    this.off += 8;
    return v;
  }
  i64(): bigint {
    const v = this.view.getBigInt64(this.off, true);
    this.off += 8;
    return v;
  }
  bytes(n: number): Uint8Array {
    const v = this.buf.subarray(this.off, this.off + n);
    this.off += n;
    return v;
  }
  pubkey(): string {
    return encodeBase58(this.bytes(32));
  }
  string(): string {
    const len = this.u32();
    return new TextDecoder().decode(this.bytes(len));
  }
}

function hex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node fallback
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export interface DecodeContext {
  signature: string;
  slot: number;
  receivedAt?: number;
}

/**
 * Decode one anchor event payload (discriminator + borsh body).
 * Returns null for events we do not care about.
 */
export function decodeEventBytes(data: Uint8Array, ctx: DecodeContext): PumpEvent | null {
  if (data.length < 8) return null;
  const disc = hex(data.subarray(0, 8));
  const r = new Reader(data.subarray(8));
  const receivedAt = ctx.receivedAt ?? Date.now();

  try {
    switch (disc) {
      case EVENT_DISCRIMINATORS.TradeEvent: {
        const ev: PumpTradeEvent = {
          kind: "trade",
          mint: r.pubkey(),
          solAmount: r.u64(),
          tokenAmount: r.u64(),
          isBuy: r.u8() === 1,
          user: r.pubkey(),
          timestamp: Number(r.i64()),
          virtualSolReserves: r.u64(),
          virtualTokenReserves: r.u64(),
          signature: ctx.signature,
          slot: ctx.slot,
          receivedAt,
        };
        // Newer program versions append real reserves (+ fee fields we ignore).
        if (r.remaining >= 16) {
          ev.realSolReserves = r.u64();
          ev.realTokenReserves = r.u64();
        }
        return ev;
      }
      case EVENT_DISCRIMINATORS.CreateEvent: {
        const ev: PumpCreateEvent = {
          kind: "create",
          name: r.string(),
          symbol: r.string(),
          uri: r.string(),
          mint: r.pubkey(),
          bondingCurve: r.pubkey(),
          creator: r.pubkey(),
          signature: ctx.signature,
          slot: ctx.slot,
          receivedAt,
        };
        return ev;
      }
      case EVENT_DISCRIMINATORS.CompleteEvent: {
        const ev: PumpCompleteEvent = {
          kind: "complete",
          user: r.pubkey(),
          mint: r.pubkey(),
          bondingCurve: r.pubkey(),
          timestamp: Number(r.i64()),
          signature: ctx.signature,
          slot: ctx.slot,
          receivedAt,
        };
        return ev;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

const PROGRAM_DATA_PREFIX = "Program data: ";

/**
 * Decode every pump.fun event contained in a transaction's log messages
 * (as delivered by `logsSubscribe` / `getTransaction().meta.logMessages`).
 */
export function decodeLogs(logs: string[], ctx: DecodeContext): PumpEvent[] {
  const out: PumpEvent[] = [];
  for (const line of logs) {
    if (!line.startsWith(PROGRAM_DATA_PREFIX)) continue;
    const b64 = line.slice(PROGRAM_DATA_PREFIX.length).trim();
    if (!b64) continue;
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(b64);
    } catch {
      continue;
    }
    const ev = decodeEventBytes(bytes, ctx);
    if (ev) out.push(ev);
  }
  return out;
}
