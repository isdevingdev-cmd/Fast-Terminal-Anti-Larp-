"use client";
import { create } from "zustand";
import type { PumpEvent, PumpTradeEvent, TokenMetadata, TrackedToken } from "../pump/types";
import { bondingProgress, lamportsToSol, marketCapSol } from "../pump/curve";
import { INITIAL_VIRTUAL_SOL_LAMPORTS, INITIAL_VIRTUAL_TOKEN_UNITS } from "../pump/constants";
import type { LarpReport } from "../larpcheck/types";

const MAX_TOKENS = 1500;
const MAX_RECENT_TRADES = 400;
/** trades within this many slots of creation count as "bundle" */
const BUNDLE_SLOT_WINDOW = 1;

export type FeedStatus = "idle" | "connecting" | "live" | "error" | "paused";

export interface TokenStoreState {
  tokens: Map<string, TrackedToken>;
  /** monotonically increasing counter so selectors can memoize on it */
  version: number;
  feedStatus: FeedStatus;
  lastSlot: number;
  eventsPerSec: number;
  paused: boolean;
  larp: Map<string, LarpReport | { status: "loading" | "none" }>;
  selectedMint: string | null;

  applyEvents: (events: PumpEvent[]) => void;
  setFeedStatus: (s: FeedStatus) => void;
  setPaused: (p: boolean) => void;
  setMetadata: (mint: string, md: TokenMetadata | null) => void;
  setLarp: (mint: string, report: LarpReport | { status: "loading" | "none" }) => void;
  select: (mint: string | null) => void;
  /** register a token we learned about outside the create stream (e.g. direct URL) */
  ensureToken: (mint: string, partial?: Partial<TrackedToken>) => TrackedToken;
}

export function blankToken(mint: string, partial: Partial<TrackedToken> = {}): TrackedToken {
  return {
    mint,
    name: partial.name ?? "",
    symbol: partial.symbol ?? "",
    uri: partial.uri ?? "",
    bondingCurve: partial.bondingCurve ?? "",
    creator: partial.creator ?? "",
    createdAt: partial.createdAt ?? Date.now(),
    createdKnown: partial.createdKnown ?? false,
    totalSupplyUnits: partial.totalSupplyUnits ?? 1_000_000_000_000_000n,
    initialVirtualSol: partial.initialVirtualSol ?? INITIAL_VIRTUAL_SOL_LAMPORTS,
    source: "pump",
    stage: partial.stage ?? "bonding",
    metadataStatus: "idle",
    virtualSolReserves: partial.virtualSolReserves ?? INITIAL_VIRTUAL_SOL_LAMPORTS,
    virtualTokenReserves: partial.virtualTokenReserves ?? INITIAL_VIRTUAL_TOKEN_UNITS,
    marketCapSol: marketCapSol(
      partial.virtualSolReserves ?? INITIAL_VIRTUAL_SOL_LAMPORTS,
      partial.virtualTokenReserves ?? INITIAL_VIRTUAL_TOKEN_UNITS,
    ),
    bondingProgress: 0,
    lastTradeAt: partial.createdAt ?? Date.now(),
    tradeCount: 0,
    buyCount: 0,
    sellCount: 0,
    volumeSol: 0,
    traders: new Set(),
    devNetSol: 0,
    devSold: false,
    bundleShare: 0,
    creatorTokenUnits: 0n,
    recentTrades: [],
    zeroSolTrades: 0,
    ...partial,
  };
}

function applyTrade(t: TrackedToken, ev: PumpTradeEvent, createSlot: number | undefined) {
  // Zero-SOL "trades" (Mayhem agent inventory moves, internal transfers) carry no price information.
  if (ev.solAmount === 0n || ev.virtualSolReserves === 0n) {
    t.zeroSolTrades += 1;
    t.traders.add(ev.user);
    return;
  }
  t.virtualSolReserves = ev.virtualSolReserves;
  t.virtualTokenReserves = ev.virtualTokenReserves;
  t.marketCapSol = marketCapSol(ev.virtualSolReserves, ev.virtualTokenReserves, t.totalSupplyUnits);
  t.bondingProgress = bondingProgress(ev.virtualTokenReserves);
  t.lastTradeAt = ev.receivedAt;
  t.tradeCount += 1;
  if (ev.isBuy) t.buyCount += 1;
  else t.sellCount += 1;
  const sol = lamportsToSol(ev.solAmount);
  t.volumeSol += sol;
  t.traders.add(ev.user);
  if (t.creator && ev.user === t.creator) {
    t.devNetSol += ev.isBuy ? sol : -sol;
    t.creatorTokenUnits += ev.isBuy ? ev.tokenAmount : -ev.tokenAmount;
    if (!ev.isBuy) t.devSold = true;
  }
  if (createSlot !== undefined && ev.isBuy && ev.slot - createSlot <= BUNDLE_SLOT_WINDOW) {
    // share of total supply bought in the launch slot(s)
    t.bundleShare += Number(ev.tokenAmount) / 1e15;
  }
  t.recentTrades.push(ev);
  if (t.recentTrades.length > MAX_RECENT_TRADES) t.recentTrades.splice(0, t.recentTrades.length - MAX_RECENT_TRADES);
  if (t.stage === "new" && (t.bondingProgress >= 0.3 || Date.now() - t.createdAt > 30 * 60_000)) {
    t.stage = "bonding";
  }
}

const createSlots = new Map<string, number>();

export const useTokenStore = create<TokenStoreState>()((set, get) => ({
  tokens: new Map(),
  version: 0,
  feedStatus: "idle",
  lastSlot: 0,
  eventsPerSec: 0,
  paused: false,
  larp: new Map(),
  selectedMint: null,

  applyEvents: (events) => {
    if (events.length === 0) return;
    const tokens = get().tokens; // mutate in place, bump version for subscribers
    let lastSlot = get().lastSlot;
    for (const ev of events) {
      if (ev.slot > lastSlot) lastSlot = ev.slot;
      if (ev.kind === "create") {
        createSlots.set(ev.mint, ev.slot);
        const existing = tokens.get(ev.mint);
        const t = existing ?? blankToken(ev.mint);
        t.name = ev.name;
        t.symbol = ev.symbol;
        t.uri = ev.uri;
        t.bondingCurve = ev.bondingCurve;
        t.creator = ev.creator || ev.user;
        t.createdAt = ev.timestamp ? ev.timestamp * 1000 : ev.receivedAt;
        t.createdKnown = true;
        if (ev.tokenTotalSupply) t.totalSupplyUnits = ev.tokenTotalSupply;
        if (ev.virtualSolReserves) {
          t.initialVirtualSol = ev.virtualSolReserves;
          t.virtualSolReserves = ev.virtualSolReserves;
        }
        if (ev.virtualTokenReserves) t.virtualTokenReserves = ev.virtualTokenReserves;
        t.marketCapSol = marketCapSol(t.virtualSolReserves, t.virtualTokenReserves, t.totalSupplyUnits);
        t.stage = "new";
        tokens.delete(ev.mint); // re-insert to keep Map in insertion order (recent last)
        tokens.set(ev.mint, t);
      } else if (ev.kind === "trade") {
        let t = tokens.get(ev.mint);
        if (!t) {
          // Token created before we connected: identity and age unknown until metadata/backfill resolve them.
          t = blankToken(ev.mint, { createdAt: ev.receivedAt, createdKnown: false, stage: "bonding" });
          tokens.set(ev.mint, t);
        }
        applyTrade(t, ev, createSlots.get(ev.mint));
      } else if (ev.kind === "complete") {
        const t = tokens.get(ev.mint) ?? blankToken(ev.mint, { createdAt: ev.receivedAt });
        t.stage = "migrated";
        t.bondingProgress = 1;
        t.lastTradeAt = ev.receivedAt;
        tokens.set(ev.mint, t);
      }
    }
    // prune: drop the oldest inactive tokens beyond the cap
    if (tokens.size > MAX_TOKENS) {
      const sorted = [...tokens.values()].sort((a, b) => a.lastTradeAt - b.lastTradeAt);
      const drop = sorted.slice(0, tokens.size - MAX_TOKENS);
      for (const t of drop) if (t.mint !== get().selectedMint) tokens.delete(t.mint);
    }
    set((s) => ({ version: s.version + 1, lastSlot }));
  },

  setFeedStatus: (feedStatus) => set({ feedStatus }),
  setPaused: (paused) => set({ paused }),
  setMetadata: (mint, md) => {
    const t = get().tokens.get(mint);
    if (!t) return;
    t.metadata = md ?? undefined;
    t.metadataStatus = md ? "done" : "error";
    set((s) => ({ version: s.version + 1 }));
  },
  setLarp: (mint, report) => {
    const larp = new Map(get().larp);
    larp.set(mint, report);
    set({ larp });
  },
  select: (selectedMint) => set({ selectedMint }),
  ensureToken: (mint, partial) => {
    const tokens = get().tokens;
    let t = tokens.get(mint);
    if (!t) {
      t = blankToken(mint, partial);
      tokens.set(mint, t);
      set((s) => ({ version: s.version + 1 }));
    }
    return t;
  },
}));

/** Derived lists; call inside useMemo keyed on `version`. */
export function selectColumns(tokens: Map<string, TrackedToken>) {
  const all = [...tokens.values()];
  const fresh = all.filter((t) => t.stage === "new" && t.createdKnown).sort((a, b) => b.createdAt - a.createdAt);
  // Column thresholds (e.g. bonding ≥ 30 %) live in the per-column filters; here we only split by stage.
  const bonding = all
    .filter((t) => t.stage === "bonding" && t.marketCapSol > 0)
    .sort((a, b) => b.bondingProgress - a.bondingProgress || b.lastTradeAt - a.lastTradeAt);
  const migrated = all.filter((t) => t.stage === "migrated").sort((a, b) => b.lastTradeAt - a.lastTradeAt);
  return { fresh, bonding, migrated };
}
