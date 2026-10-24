"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePositions, type Position } from "@/lib/store/positions";
import { useWallet } from "@/lib/wallet/store";
import { useTokenStore } from "@/lib/store/tokens";
import { useTokenBalances } from "@/lib/hooks/useTokenBalances";
import { fmtCompact, fmtSol, shortAddr, timeAgo } from "@/lib/format";
import { priceSol } from "@/lib/pump/curve";
import { useQuickTrade } from "@/lib/trade/useQuickTrade";
import { TierBadge } from "@/components/larp/TierBadge";
import { blankToken } from "@/lib/store/tokens";

function SellButtons({ p }: { p: Position }) {
  const tokens = useTokenStore((s) => s.tokens);
  const { sell, ready } = useQuickTrade();
  const [busy, setBusy] = useState<string | null>(null);
  const token = tokens.get(p.mint) ?? blankToken(p.mint, { symbol: p.symbol });
  const balUnits = p.tokens ? BigInt(Math.round(p.tokens * 1e6)) : undefined;
  const go = async (pct: `${number}%`) => {
    if (!ready) return;
    setBusy(pct);
    try {
      await sell(token, pct, balUnits);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <span className="inline-flex gap-1">
      {(["25%", "50%", "100%"] as const).map((pct) => (
        <button key={pct} disabled={!ready || !!busy} onClick={() => void go(pct)} className="rounded bg-dn/15 px-1.5 py-0.5 text-[10.5px] font-bold text-dn hover:bg-dn/25 disabled:opacity-40">
          {busy === pct ? "…" : pct}
        </button>
      ))}
    </span>
  );
}

export function HoldingsPanel() {
  useTokenBalances();
  const wallet = useWallet((s) => s.wallets.find((w) => w.id === s.activeId)?.publicKey ?? null);
  const positions = usePositions((s) => s.positions);
  const trades = usePositions((s) => s.trades);
  const closePosition = usePositions((s) => s.closePosition);
  const tokens = useTokenStore((s) => s.tokens);
  const version = useTokenStore((s) => s.version);
  const larp = useTokenStore((s) => s.larp);
  const [tab, setTab] = useState<"positions" | "history">("positions");

  const rows = useMemo(() => {
    void version;
    return Object.values(positions)
      .filter((p) => p.wallet === wallet)
      .map((p) => {
        const t = tokens.get(p.mint);
        const price = t ? priceSol(t.virtualSolReserves, t.virtualTokenReserves) : 0;
        const value = (p.tokens ?? 0) * price;
        const pnl = value - p.costSol;
        return { p, t, value, pnl, pct: p.costSol > 0 ? (pnl / p.costSol) * 100 : 0 };
      })
      .sort((a, b) => b.p.lastTradeAt - a.p.lastTradeAt);
  }, [positions, wallet, tokens, version]);

  const totalPnl = rows.reduce((a, r) => a + r.pnl, 0);

  return (
    <div className="flex min-h-0 flex-col border-t border-line bg-panel">
      <h3 className="flex h-9 items-center gap-4 border-b border-line px-3.5 text-xs">
        <button onClick={() => setTab("positions")} className={tab === "positions" ? "font-bold text-txt" : "text-mut"}>
          Positions ({rows.length})
        </button>
        <button onClick={() => setTab("history")} className={tab === "history" ? "font-bold text-txt" : "text-mut"}>
          Historique
        </button>
        <span className="ml-auto text-mut">
          PnL ouvert <b className={totalPnl >= 0 ? "text-up" : "text-dn"}>{fmtSol(totalPnl, 3)} SOL</b>
        </span>
      </h3>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "positions" ? (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-dim">
                <th className="px-3.5 py-2 text-left font-semibold">Token</th>
                <th className="px-3.5 py-2 text-right font-semibold">Qté</th>
                <th className="px-3.5 py-2 text-right font-semibold">Coût</th>
                <th className="px-3.5 py-2 text-right font-semibold">Valeur</th>
                <th className="px-3.5 py-2 text-right font-semibold">PnL</th>
                <th className="px-3.5 py-2 text-left font-semibold">LarpCheck</th>
                <th className="px-3.5 py-2 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, t, value, pnl, pct }) => (
                <tr key={p.mint} className="border-t border-line">
                  <td className="px-3.5 py-2">
                    <Link href={`/token/${p.mint}`} className="font-semibold hover:text-acc2">
                      {t?.symbol || p.symbol || shortAddr(p.mint)} <span className="font-normal text-dim">· {timeAgo(p.firstBuyAt)}</span>
                    </Link>
                  </td>
                  <td className="px-3.5 py-2 text-right">{p.tokens !== undefined ? fmtCompact(p.tokens) : "…"}</td>
                  <td className="px-3.5 py-2 text-right">{fmtSol(p.costSol, 3)} SOL</td>
                  <td className="px-3.5 py-2 text-right">{t ? `${fmtSol(value, 3)} SOL` : "—"}</td>
                  <td className={`px-3.5 py-2 text-right font-semibold ${pnl >= 0 ? "text-up" : "text-dn"}`}>
                    {t ? `${fmtSol(pnl, 3)} (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%)` : "—"}
                  </td>
                  <td className="px-3.5 py-2">
                    <TierBadge entry={larp.get(p.mint)} />
                  </td>
                  <td className="px-3.5 py-2 text-right">
                    <SellButtons p={p} />
                    {(p.tokens === 0 || p.tokens === undefined) && (
                      <button className="ml-1 text-dim hover:text-txt" title="Retirer de la liste" onClick={() => closePosition(p.wallet, p.mint)}>
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3.5 py-5 text-center text-dim">
                    {wallet ? "Aucune position sur ce wallet." : "Crée ou déverrouille un wallet pour voir tes positions."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse text-xs">
            <tbody>
              {trades
                .filter((tr) => tr.wallet === wallet)
                .slice(0, 50)
                .map((tr) => (
                  <tr key={tr.signature} className="border-t border-line">
                    <td className="px-3.5 py-1.5 text-dim">{new Date(tr.sentAt).toLocaleTimeString("fr-FR")}</td>
                    <td className={`px-3.5 py-1.5 font-semibold ${tr.side === "buy" ? "text-up" : "text-dn"}`}>{tr.side === "buy" ? "Achat" : "Vente"}</td>
                    <td className="px-3.5 py-1.5">{tr.symbol || shortAddr(tr.mint)}</td>
                    <td className="px-3.5 py-1.5 text-right">{fmtSol(tr.solAmount, 3)} SOL</td>
                    <td className="px-3.5 py-1.5">
                      <span className={`flag ${tr.status === "confirmed" ? "flag-g" : tr.status === "failed" ? "flag-b" : "flag-w"}`}>{tr.status}</span>
                    </td>
                    <td className="px-3.5 py-1.5 text-right">
                      <a className="text-acc2 hover:underline" href={`https://solscan.io/tx/${tr.signature}`} target="_blank" rel="noreferrer">
                        solscan ↗
                      </a>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
