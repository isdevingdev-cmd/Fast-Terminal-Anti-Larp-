import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCandles, pushTrade } from "../src/lib/chart/candles";
import type { PumpTradeEvent } from "../src/lib/pump/types";

function trade(ts: number, vSol: number, sol = 0.1): PumpTradeEvent {
  const vSolL = BigInt(Math.round(vSol * 1e9));
  const k = 30_000_000_000n * 1_073_000_000_000_000n;
  return {
    kind: "trade", mint: "m", solAmount: BigInt(Math.round(sol * 1e9)), tokenAmount: 1n, isBuy: true, user: "u", timestamp: ts,
    virtualSolReserves: vSolL, virtualTokenReserves: k / vSolL, signature: `s${ts}`, slot: ts, receivedAt: ts * 1000,
  };
}

test("builds 5s candles with gap filling", () => {
  const c = buildCandles([trade(1000, 30), trade(1002, 31), trade(1012, 32)], "5s");
  assert.deepEqual(c.map((x) => x.time), [1000, 1005, 1010]);
  assert.equal(c[1].volume, 0); // gap candle
  assert.ok(c[0].close > c[0].open);
  assert.equal(c[2].open, c[1].close);
  assert.ok(Math.abs(c[0].volume - 0.2) < 1e-9);
});

test("pushTrade merges into current bucket or opens a new one", () => {
  const c = buildCandles([trade(1000, 30)], "1s");
  const same = pushTrade(c, trade(1000, 30.5), "1s");
  assert.equal(c.length, 1);
  assert.equal(same.close > same.open, true);
  pushTrade(c, trade(1001, 30.2), "1s");
  assert.equal(c.length, 2);
  assert.equal(c[1].open, c[0].close);
});
