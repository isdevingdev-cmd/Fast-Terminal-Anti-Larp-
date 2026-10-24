"use client";
import { useMemo } from "react";
import type { TrackedToken } from "@/lib/pump/types";
import { useMarket } from "@/lib/store/market";
import { useWallet } from "@/lib/wallet/store";
import { fmtCompact, fmtSol, fmtUsd, shortAddr } from "@/lib/format";
import { marketCapSol } from "@/lib/pump/curve";

export function TradesTable({ token }: { token: TrackedToken }) {
  const solUsd = useMarket((s) => s.solUsd);
  const wallets = useWallet((s) => s.wallets);
  const mine = useMemo(() => new Set(wallets.map((w) => w.publicKey)), [wallets]);
  const rows = [...token.recentTrades].reverse().slice(0, 150);
  return (
    <table className="w-full border-collapse text-[11.5px]">
      <thead className="sticky top-0 bg-panel">
        <tr className="text-[10px] uppercase tracking-wider text-dim">
          <th className="px-3 py-1.5 text-left font-semibold">Heure</th>
          <th className="px-3 py-1.5 text-left font-semibold">Type</th>
          <th className="px-3 py-1.5 text-right font-semibold">MC</th>
          <th className="px-3 py-1.5 text-right font-semibold">SOL</th>
          <th className="px-3 py-1.5 text-right font-semibold">Tokens</th>
          <th className="px-3 py-1.5 text-left font-semibold">Wallet</th>
          <th className="px-3 py-1.5 text-left font-semibold">Tags</th>
          <th className="px-3 py-1.5 text-right font-semibold">Tx</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => {
          const mc = marketCapSol(t.virtualSolReserves, t.virtualTokenReserves);
          const isDev = token.creator && t.user === token.creator;
          const isMe = mine.has(t.user);
          return (
            <tr key={t.signature + t.user} className={`border-t border-line ${t.isBuy ? "shadow-[inset_3px_0_0_var(--color-up)]" : "shadow-[inset_3px_0_0_var(--color-dn)]"}`}>
              <td className="px-3 py-1.5 text-dim">{new Date(t.timestamp * 1000).toLocaleTimeString("fr-FR")}</td>
              <td className={`px-3 py-1.5 font-semibold ${t.isBuy ? "text-up" : "text-dn"}`}>{t.isBuy ? "Achat" : "Vente"}</td>
              <td className="px-3 py-1.5 text-right">{solUsd ? fmtUsd(mc * solUsd) : `${fmtCompact(mc)} SOL`}</td>
              <td className={`px-3 py-1.5 text-right ${t.isBuy ? "text-up" : "text-dn"}`}>
                {t.isBuy ? "+" : "−"}
                {fmtSol(Number(t.solAmount) / 1e9, 3)}
              </td>
              <td className="px-3 py-1.5 text-right">{fmtCompact(Number(t.tokenAmount) / 1e6)}</td>
              <td className="px-3 py-1.5 font-mono text-mut">
                <a href={`https://solscan.io/account/${t.user}`} target="_blank" rel="noreferrer" className="hover:text-txt">
                  {shortAddr(t.user)}
                </a>
              </td>
              <td className="px-3 py-1.5">
                {isDev && <span className="flag flag-p">DEV</span>} {isMe && <span className="flag flag-c">Moi</span>}
              </td>
              <td className="px-3 py-1.5 text-right">
                <a href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noreferrer" className="text-dim hover:text-txt">
                  ↗
                </a>
              </td>
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="px-3 py-6 text-center text-dim">
              Aucun trade en mémoire pour l&apos;instant.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
