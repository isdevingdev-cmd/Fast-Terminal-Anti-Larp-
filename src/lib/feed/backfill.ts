"use client";
/**
 * Backfill recent history of one token straight from the chain:
 * signatures of its bonding-curve account → transactions → decoded pump events.
 * Used when opening a token page so the chart and trade list are not empty.
 */
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { PUMP_PROGRAM_ID } from "../pump/constants";
import { decodeLogs } from "../pump/decoder";
import type { PumpTradeEvent } from "../pump/types";
import { useTokenStore } from "../store/tokens";
import { getConnection } from "../wallet/store";
import { bondingProgress, marketCapSol } from "../pump/curve";

const done = new Set<string>();

export function bondingCurveFor(mint: string): string {
  return PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), new PublicKey(mint).toBuffer()], new PublicKey(PUMP_PROGRAM_ID))[0].toBase58();
}

export async function backfillToken(mint: string, limit = 300): Promise<number> {
  if (done.has(mint)) return 0;
  done.add(mint);
  const conn = getConnection();
  const store = useTokenStore.getState();
  const token = store.ensureToken(mint);
  const curve = token.bondingCurve || bondingCurveFor(mint);
  if (!token.bondingCurve) token.bondingCurve = curve;

  let sigs: { signature: string; slot: number; blockTime?: number | null; err: unknown }[] = [];
  try {
    sigs = await conn.getSignaturesForAddress(new PublicKey(curve), { limit }, "confirmed");
  } catch (e) {
    console.warn("[backfill] signatures", e);
    done.delete(mint);
    return 0;
  }
  const ok = sigs.filter((s) => !s.err);
  const known = new Set(token.recentTrades.map((t) => t.signature));
  const want = ok.filter((s) => !known.has(s.signature)).map((s) => s.signature);
  const trades: PumpTradeEvent[] = [];
  for (let i = 0; i < want.length; i += 100) {
    const chunk = want.slice(i, i + 100);
    let txs: Awaited<ReturnType<typeof conn.getTransactions>> = [];
    try {
      txs = await conn.getTransactions(chunk, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    } catch (e) {
      console.warn("[backfill] getTransactions", e);
      break;
    }
    txs.forEach((tx, j) => {
      if (!tx?.meta?.logMessages) return;
      const evs = decodeLogs(tx.meta.logMessages, { signature: chunk[j], slot: tx.slot, receivedAt: (tx.blockTime ?? 0) * 1000 || Date.now() });
      for (const ev of evs) {
        if (ev.kind === "trade" && ev.mint === mint) trades.push(ev);
        if (ev.kind === "create" && ev.mint === mint) {
          if (!token.name) token.name = ev.name;
          if (!token.symbol) token.symbol = ev.symbol;
          if (!token.uri) token.uri = ev.uri;
          if (!token.creator) token.creator = ev.creator;
          token.createdAt = Math.min(token.createdAt, ev.receivedAt);
          token.stage = token.stage === "migrated" ? "migrated" : token.stage;
        }
        if (ev.kind === "complete" && ev.mint === mint) token.stage = "migrated";
      }
    });
  }
  if (trades.length) {
    const merged = [...token.recentTrades, ...trades];
    merged.sort((a, b) => a.timestamp - b.timestamp || a.slot - b.slot);
    token.recentTrades = merged.slice(-1000);
    // Fill identity stats from history when the live feed had nothing yet.
    if (token.tradeCount === 0) {
      token.tradeCount = trades.length;
      token.buyCount = trades.filter((t) => t.isBuy).length;
      token.sellCount = trades.length - token.buyCount;
      token.volumeSol = trades.reduce((a, t) => a + Number(t.solAmount) / 1e9, 0);
      for (const t of trades) token.traders.add(t.user);
      const latest = token.recentTrades[token.recentTrades.length - 1];
      if (latest) {
        token.virtualSolReserves = latest.virtualSolReserves;
        token.virtualTokenReserves = latest.virtualTokenReserves;
        token.marketCapSol = marketCapSol(latest.virtualSolReserves, latest.virtualTokenReserves);
        token.bondingProgress = bondingProgress(latest.virtualTokenReserves);
        token.lastTradeAt = latest.receivedAt;
      }
      if (token.creator) {
        for (const t of trades) {
          if (t.user !== token.creator) continue;
          token.creatorTokenUnits += t.isBuy ? t.tokenAmount : -t.tokenAmount;
          token.devNetSol += (t.isBuy ? 1 : -1) * (Number(t.solAmount) / 1e9);
          if (!t.isBuy) token.devSold = true;
        }
      }
    }
  }
  useTokenStore.setState((s) => ({ version: s.version + 1 }));
  return trades.length;
}
