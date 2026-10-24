"use client";
import type { TradeProvider, TradeRequest } from "./types";

/**
 * PumpPortal Local Transaction API provider.
 * Pros: works on pump curve, PumpSwap, Raydium, Bonk... from day one.
 * Cons: PumpPortal keeps 0.5 % on each trade on top of our platform fee.
 * The native provider removes that middleman (see ./native.ts).
 */
export const pumpPortalProvider: TradeProvider = {
  id: "pumpportal",
  async buildSwap(req: TradeRequest, userPublicKey: string) {
    const res = await fetch("/api/trade/build", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicKey: userPublicKey,
        action: req.side,
        mint: req.mint,
        amount: req.amount,
        denominatedInSol: req.side === "buy",
        slippage: req.slippagePct,
        priorityFee: req.priorityFeeSol,
        pool: req.pool,
      }),
    });
    const json = (await res.json()) as { txBase64?: string; error?: string };
    if (!res.ok || !json.txBase64) throw new Error(json.error ?? "build failed");
    return { txBase64: json.txBase64 };
  },
};
