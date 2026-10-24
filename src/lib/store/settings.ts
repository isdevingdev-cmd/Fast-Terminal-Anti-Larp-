"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SpeedPreset } from "../config";
import type { LarpTier } from "../larpcheck/types";

export interface LarpFilters {
  /** hide tokens whose tier is below this (null = no filter) */
  minTier: LarpTier | null;
  hideFullLarp: boolean;
  hideBundled: boolean; // bundleShare > 0.3
  hideDevHeavy: boolean; // dev holding > 10 %
  requireGithub: boolean;
}

export interface SettingsState {
  quickBuyPresets: number[];
  quickBuyAmount: number;
  quickSellPresets: number[]; // percentages
  slippagePct: number;
  speed: SpeedPreset;
  mevProtect: boolean;
  minMarketCapSol: number;
  larp: LarpFilters;
  showUsd: boolean;
  set: (patch: Partial<Omit<SettingsState, "set" | "setLarp">>) => void;
  setLarp: (patch: Partial<LarpFilters>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      quickBuyPresets: [0.1, 0.5, 1, 2],
      quickBuyAmount: 0.5,
      quickSellPresets: [25, 50, 100],
      slippagePct: 20,
      speed: "fast",
      mevProtect: true,
      minMarketCapSol: 0,
      larp: {
        minTier: null,
        hideFullLarp: false,
        hideBundled: false,
        hideDevHeavy: false,
        requireGithub: false,
      },
      showUsd: true,
      set: (patch) => set(patch),
      setLarp: (patch) => set((s) => ({ larp: { ...s.larp, ...patch } })),
    }),
    { name: "fast-terminal.settings" },
  ),
);
