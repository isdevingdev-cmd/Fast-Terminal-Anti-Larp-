"use client";
/**
 * Native pump.fun provider: bonding curve (v3) and PumpSwap, quoted from on-chain fee configs,
 * built locally — no middleman fee. See ./pumpRouter.ts and docs/pump-v3.md.
 * Buy and sell on the curve were simulated successfully on mainnet (2026-10-25).
 */
import { ComputeBudgetProgram, Connection, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { ataOf, buildTradeIxs, loadRoute, type Route } from "./pumpRouter";
import type { TradeProvider, TradeRequest } from "./types";

export interface NativeBuild {
  instructions: TransactionInstruction[];
  route: Route;
  expected: bigint;
  minOut: bigint;
  feeBps: bigint;
}

/** Resolve the sell amount (whole tokens or "NN%") into base units. */
async function sellUnits(connection: Connection, route: Route, user: PublicKey, amount: number | `${number}%`): Promise<bigint> {
  if (typeof amount === "string" && amount.endsWith("%")) {
    const bal = await connection.getTokenAccountBalance(ataOf(user, route.mint, route.tokenProgram), "processed").catch(() => null);
    const have = BigInt(bal?.value.amount ?? "0");
    return (have * BigInt(Math.round(parseFloat(amount)))) / 100n;
  }
  return BigInt(Math.round(Number(amount) * 10 ** route.decimals));
}

export async function buildNativeInstructions(connection: Connection, req: TradeRequest, user: PublicKey): Promise<NativeBuild> {
  const route = await loadRoute(connection, req.mint);
  const amount = req.side === "buy" ? BigInt(Math.round(Number(req.amount) * 1e9)) : await sellUnits(connection, route, user, req.amount);
  if (amount <= 0n) throw new Error(req.side === "buy" ? "Montant invalide" : "Rien à vendre");
  const { ixs, expected, minOut, feeBps } = await buildTradeIxs(connection, route, user, req.side, amount, req.slippagePct);
  const units = route.venue === "pump" ? 120_000 : 180_000;
  const priceMicro = Math.max(1, Math.floor((req.priorityFeeSol * 1e9 * 1e6) / units));
  const instructions = [ComputeBudgetProgram.setComputeUnitLimit({ units }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priceMicro }), ...ixs];
  return { instructions, route, expected, minOut, feeBps };
}

export function makeNativeProvider(connection: Connection): TradeProvider {
  return {
    id: "native",
    async buildSwap(req: TradeRequest, userPublicKey: string) {
      const user = new PublicKey(userPublicKey);
      const { instructions } = await buildNativeInstructions(connection, req, user);
      const { blockhash } = await connection.getLatestBlockhash("processed");
      const msg = new TransactionMessage({ payerKey: user, recentBlockhash: blockhash, instructions }).compileToV0Message();
      return { txBase64: Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64") };
    },
  };
}
