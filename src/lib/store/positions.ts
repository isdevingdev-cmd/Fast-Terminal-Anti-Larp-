"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TxStatus = "pending" | "confirmed" | "failed";

export interface TradeRecord {
  signature: string;
  wallet: string;
  mint: string;
  symbol: string;
  side: "buy" | "sell";
  solAmount: number;
  sentAt: number;
  status: TxStatus;
}

export interface Position {
  wallet: string;
  mint: string;
  symbol: string;
  /** SOL spent on buys minus SOL received on sells */
  costSol: number;
  buys: number;
  sells: number;
  firstBuyAt: number;
  lastTradeAt: number;
  /** token balance in whole tokens (refreshed from chain) */
  tokens?: number;
  tp?: number; // take-profit multiple e.g. 2 = +100 %
  sl?: number; // stop-loss fraction e.g. 0.3 = -30 %
}

interface PositionsState {
  trades: TradeRecord[];
  positions: Record<string, Position>; // key wallet:mint
  recordPending: (t: Omit<TradeRecord, "status">) => void;
  resolvePending: (signature: string, status: TxStatus) => void;
  setBalance: (wallet: string, mint: string, tokens: number) => void;
  setRules: (wallet: string, mint: string, rules: { tp?: number; sl?: number }) => void;
  closePosition: (wallet: string, mint: string) => void;
}

const key = (w: string, m: string) => `${w}:${m}`;

export const usePositions = create<PositionsState>()(
  persist(
    (set, get) => ({
      trades: [],
      positions: {},
      recordPending: (t) => {
        const trades = [{ ...t, status: "pending" as TxStatus }, ...get().trades].slice(0, 500);
        const positions = { ...get().positions };
        const k = key(t.wallet, t.mint);
        const p = positions[k] ?? {
          wallet: t.wallet,
          mint: t.mint,
          symbol: t.symbol,
          costSol: 0,
          buys: 0,
          sells: 0,
          firstBuyAt: t.sentAt,
          lastTradeAt: t.sentAt,
        };
        if (t.side === "buy") {
          p.costSol += t.solAmount;
          p.buys += 1;
        } else {
          p.costSol -= t.solAmount;
          p.sells += 1;
        }
        p.lastTradeAt = t.sentAt;
        if (t.symbol && !p.symbol) p.symbol = t.symbol;
        positions[k] = p;
        set({ trades, positions });
      },
      resolvePending: (signature, status) => {
        set({ trades: get().trades.map((t) => (t.signature === signature ? { ...t, status } : t)) });
      },
      setBalance: (wallet, mint, tokens) => {
        const positions = { ...get().positions };
        const p = positions[key(wallet, mint)];
        if (!p) return;
        positions[key(wallet, mint)] = { ...p, tokens };
        set({ positions });
      },
      setRules: (wallet, mint, rules) => {
        const positions = { ...get().positions };
        const p = positions[key(wallet, mint)];
        if (!p) return;
        positions[key(wallet, mint)] = { ...p, ...rules };
        set({ positions });
      },
      closePosition: (wallet, mint) => {
        const positions = { ...get().positions };
        delete positions[key(wallet, mint)];
        set({ positions });
      },
    }),
    { name: "fast-terminal.positions" },
  ),
);
