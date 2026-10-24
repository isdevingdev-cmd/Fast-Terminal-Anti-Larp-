import type { PumpTradeEvent } from "../pump/types";
import { marketCapSol } from "../pump/curve";

export interface Candle {
  /** unix seconds (bucket start) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // SOL
}

export const TIMEFRAMES = { "1s": 1, "5s": 5, "15s": 15, "1m": 60, "5m": 300 } as const;
export type Timeframe = keyof typeof TIMEFRAMES;

/** Value plotted per trade: market cap in SOL after the trade (×solUsd for USD). */
export function tradeValue(t: PumpTradeEvent, solUsd = 1): number {
  return marketCapSol(t.virtualSolReserves, t.virtualTokenReserves) * solUsd;
}

/** Aggregate trades (any order) into OHLCV candles for the timeframe. Gaps are filled with flat candles. */
export function buildCandles(trades: PumpTradeEvent[], tf: Timeframe, solUsd = 1, fillGaps = true): Candle[] {
  const size = TIMEFRAMES[tf];
  if (!trades.length) return [];
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp || a.slot - b.slot);
  const out: Candle[] = [];
  let cur: Candle | null = null;
  for (const t of sorted) {
    const bucket = Math.floor(t.timestamp / size) * size;
    const v = tradeValue(t, solUsd);
    const vol = Number(t.solAmount) / 1e9;
    if (!cur || cur.time !== bucket) {
      if (cur && fillGaps) {
        for (let b = cur.time + size; b < bucket; b += size) {
          out.push({ time: b, open: cur.close, high: cur.close, low: cur.close, close: cur.close, volume: 0 });
        }
      }
      cur = { time: bucket, open: cur ? cur.close : v, high: v, low: v, close: v, volume: vol };
      if (!out.length) cur.open = v;
      out.push(cur);
    } else {
      cur.high = Math.max(cur.high, v);
      cur.low = Math.min(cur.low, v);
      cur.close = v;
      cur.volume += vol;
    }
  }
  return out;
}

/** Incrementally merge one trade into an existing candle array (mutates and returns the touched candle). */
export function pushTrade(candles: Candle[], t: PumpTradeEvent, tf: Timeframe, solUsd = 1): Candle {
  const size = TIMEFRAMES[tf];
  const bucket = Math.floor(t.timestamp / size) * size;
  const v = tradeValue(t, solUsd);
  const vol = Number(t.solAmount) / 1e9;
  const last = candles[candles.length - 1];
  if (last && last.time === bucket) {
    last.high = Math.max(last.high, v);
    last.low = Math.min(last.low, v);
    last.close = v;
    last.volume += vol;
    return last;
  }
  if (last && bucket < last.time) return last; // out-of-order straggler: ignore for the live path
  const c: Candle = { time: bucket, open: last ? last.close : v, high: v, low: v, close: v, volume: vol };
  candles.push(c);
  return c;
}
