"use client";
import { useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { getConnection, useWallet } from "../wallet/store";
import { usePositions } from "../store/positions";

const TOKEN_PROGRAMS = [
  new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"), // Token-2022 (pump.fun since 2025)
];

/** Polls SPL balances of the active wallet and syncs them into open positions. */
export function useTokenBalances(intervalMs = 10_000) {
  const activeId = useWallet((s) => s.activeId);
  const wallet = useWallet((s) => s.wallets.find((w) => w.id === s.activeId)?.publicKey ?? null);

  useEffect(() => {
    if (!wallet) return;
    let stop = false;
    const tick = async () => {
      try {
        const owner = new PublicKey(wallet);
        const results = await Promise.all(
          TOKEN_PROGRAMS.map((programId) => getConnection().getParsedTokenAccountsByOwner(owner, { programId }, "processed")),
        );
        if (stop) return;
        const seen = new Map<string, number>();
        for (const acc of results.flatMap((r) => r.value)) {
          const info = acc.account.data.parsed?.info as { mint: string; tokenAmount: { uiAmount: number | null } } | undefined;
          if (!info) continue;
          seen.set(info.mint, info.tokenAmount.uiAmount ?? 0);
        }
        const { positions, setBalance } = usePositions.getState();
        for (const p of Object.values(positions)) {
          if (p.wallet !== wallet) continue;
          const bal = seen.get(p.mint) ?? 0;
          if (p.tokens !== bal) setBalance(wallet, p.mint, bal);
        }
      } catch {
        /* transient */
      }
    };
    void tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [wallet, activeId, intervalMs]);
}
