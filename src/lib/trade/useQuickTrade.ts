"use client";
import { useCallback, useState } from "react";
import { FEE_WALLET, PLATFORM_FEE_BPS, SPEED_PRESETS } from "../config";
import { useSettings } from "../store/settings";
import { getConnection, useWallet } from "../wallet/store";
import type { TrackedToken } from "../pump/types";
import { executeTrade } from "./execute";
import type { Pool, TradeResult } from "./types";
import { lamportsToSol } from "../pump/curve";
import { quoteSell } from "../pump/curve";

function poolFor(token: TrackedToken): Pool {
  return token.stage === "migrated" ? "auto" : "pump";
}

/** Shared buy/sell helpers wired to the settings and the active wallet. */
export function useQuickTrade() {
  const settings = useSettings();
  const activeKeypair = useWallet((s) => s.activeKeypair);
  const unlocked = useWallet((s) => s.unlocked);
  const activeId = useWallet((s) => s.activeId);
  const [status, setStatus] = useState<string>("");
  const [last, setLast] = useState<TradeResult | null>(null);

  const ready = unlocked && !!activeId;

  const buy = useCallback(
    async (token: TrackedToken, sol: number) => {
      const kp = activeKeypair();
      if (!kp) throw new Error("Wallet verrouillé");
      const preset = SPEED_PRESETS[settings.speed];
      const res = await executeTrade(
        {
          side: "buy",
          mint: token.mint,
          amount: sol,
          slippagePct: settings.slippagePct,
          priorityFeeSol: preset.priorityFeeSol,
          jitoTipSol: preset.jitoTipSol,
          mevProtect: settings.mevProtect,
          pool: poolFor(token),
          platformFeeBps: PLATFORM_FEE_BPS,
          feeWallet: FEE_WALLET,
        },
        { connection: getConnection(), payer: kp, solBasis: sol, tokenSymbol: token.symbol, onStatus: setStatus },
      );
      setLast(res);
      return res;
    },
    [activeKeypair, settings.speed, settings.slippagePct, settings.mevProtect],
  );

  const sell = useCallback(
    async (token: TrackedToken, amount: number | `${number}%`, tokenBalanceUnits?: bigint) => {
      const kp = activeKeypair();
      if (!kp) throw new Error("Wallet verrouillé");
      const preset = SPEED_PRESETS[settings.speed];
      // Estimate proceeds for the platform fee basis.
      let units = 0n;
      if (typeof amount === "string") {
        units = tokenBalanceUnits ? (tokenBalanceUnits * BigInt(Math.round(parseFloat(amount)))) / 100n : 0n;
      } else units = BigInt(Math.round(amount * 1e6));
      const estSol = units > 0n ? lamportsToSol(quoteSell(token.virtualSolReserves, token.virtualTokenReserves, units)) : 0;
      const res = await executeTrade(
        {
          side: "sell",
          mint: token.mint,
          amount,
          slippagePct: settings.slippagePct,
          priorityFeeSol: preset.priorityFeeSol,
          jitoTipSol: preset.jitoTipSol,
          mevProtect: settings.mevProtect,
          pool: poolFor(token),
          platformFeeBps: PLATFORM_FEE_BPS,
          feeWallet: FEE_WALLET,
        },
        { connection: getConnection(), payer: kp, solBasis: estSol, tokenSymbol: token.symbol, onStatus: setStatus },
      );
      setLast(res);
      return res;
    },
    [activeKeypair, settings.speed, settings.slippagePct, settings.mevProtect],
  );

  return { buy, sell, ready, status, last };
}
