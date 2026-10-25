"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SpeedPreset } from "../config";
export interface SettingsState {
  quickBuyPresets: number[];
  quickBuyAmount: number;
  quickSellPresets: number[]; // percentages
  slippagePct: number;
  speed: SpeedPreset;
  mevProtect: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
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
      set: (patch) => set(patch),
    }),
    { name: "fast-terminal.settings.v2" },
  ),
);
