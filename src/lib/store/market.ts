"use client";
import { create } from "zustand";

interface MarketState {
  solUsd: number;
  latencyMs: number | null;
  setSolUsd: (v: number) => void;
  setLatency: (ms: number) => void;
}

export const useMarket = create<MarketState>()((set) => ({
  solUsd: 0,
  latencyMs: null,
  setSolUsd: (solUsd) => set({ solUsd }),
  setLatency: (latencyMs) => set({ latencyMs }),
}));

let priceTimer: ReturnType<typeof setInterval> | null = null;

export function startMarketPolling() {
  if (priceTimer || typeof window === "undefined") return;
  const tick = async () => {
    try {
      const r = await fetch("/api/solprice");
      const j = (await r.json()) as { usd: number };
      if (j.usd > 0) useMarket.getState().setSolUsd(j.usd);
    } catch {
      /* keep last */
    }
  };
  void tick();
  priceTimer = setInterval(tick, 30_000);
}
