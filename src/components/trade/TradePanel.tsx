"use client";
import { useMemo, useState } from "react";
import type { TrackedToken } from "@/lib/pump/types";
import { useSettings } from "@/lib/store/settings";
import { useMarket } from "@/lib/store/market";
import { useWallet } from "@/lib/wallet/store";
import { usePositions } from "@/lib/store/positions";
import { COMPETITOR_FEES, PLATFORM_FEE_BPS, SPEED_PRESETS } from "@/lib/config";
import { quoteBuy, solToLamports, unitsToTokens } from "@/lib/pump/curve";
import { compareFees } from "@/lib/trade/fees";
import { useQuickTrade } from "@/lib/trade/useQuickTrade";
import { fmtCompact, fmtSol } from "@/lib/format";

export function TradePanel({ token }: { token: TrackedToken }) {
  const s = useSettings();
  const solUsd = useMarket((s) => s.solUsd);
  const { buy, sell, ready, status, last } = useQuickTrade();
  const wallet = useWallet((st) => st.wallets.find((w) => w.id === st.activeId));
  const balance = useWallet((st) => (st.activeId ? st.balances.get(st.activeId) : undefined));
  const position = usePositions((p) => (wallet ? p.positions[`${wallet.publicKey}:${token.mint}`] : undefined));
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<number>(s.quickBuyAmount);
  const [sellPct, setSellPct] = useState<number>(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const preset = SPEED_PRESETS[s.speed];
  const est = useMemo(() => {
    if (side !== "buy" || !amount) return 0;
    return unitsToTokens(quoteBuy(token.virtualSolReserves, token.virtualTokenReserves, solToLamports(amount)));
  }, [side, amount, token.virtualSolReserves, token.virtualTokenReserves]);
  const fees = compareFees(amount || 0);

  const go = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (side === "buy") await buy(token, amount);
      else await sell(token, `${sellPct}%`, position?.tokens ? BigInt(Math.round(position.tokens * 1e6)) : undefined);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-line p-3.5">
      <div className="mb-2.5 grid grid-cols-2 gap-1 rounded-lg bg-bg p-[3px]">
        <button onClick={() => setSide("buy")} className={`rounded-md py-1.5 font-bold ${side === "buy" ? "bg-up text-bg" : "text-mut"}`}>
          Acheter
        </button>
        <button onClick={() => setSide("sell")} className={`rounded-md py-1.5 font-bold ${side === "sell" ? "bg-dn text-bg" : "text-mut"}`}>
          Vendre
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between text-[11px] text-dim">
        <span>
          Wallet : <b className="text-txt">{wallet?.label ?? "—"}</b> · {balance !== undefined ? `${balance.toFixed(3)} SOL` : "—"}
        </span>
        {position?.tokens ? <span>Position : {fmtCompact(position.tokens)} {token.symbol}</span> : null}
      </div>

      {side === "buy" ? (
        <>
          <div className="mb-2.5 grid grid-cols-5 gap-1.5">
            {[0.1, 0.25, 0.5, 1, 2].map((v) => (
              <button key={v} onClick={() => setAmount(v)} className={`rounded-md border py-1.5 font-semibold ${amount === v ? "border-up bg-up/15 text-up" : "border-line2 bg-bg"}`}>
                {v}
              </button>
            ))}
          </div>
          <div className="mb-2.5 flex items-center justify-between rounded-lg border border-line2 bg-bg px-3 py-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-24 bg-transparent text-base font-bold outline-none"
            />
            <span className="text-[11px] text-mut">
              SOL {solUsd ? `≈ $${(amount * solUsd).toFixed(2)}` : ""} · ≈ {fmtCompact(est)} {token.symbol || "tokens"}
            </span>
          </div>
        </>
      ) : (
        <div className="mb-2.5 grid grid-cols-4 gap-1.5">
          {[25, 50, 75, 100].map((v) => (
            <button key={v} onClick={() => setSellPct(v)} className={`rounded-md border py-1.5 font-semibold ${sellPct === v ? "border-dn bg-dn/15 text-dn" : "border-line2 bg-bg"}`}>
              {v}%
            </button>
          ))}
        </div>
      )}

      <div className="mb-2.5 grid grid-cols-4 gap-1.5">
        <div className="rounded-md border border-line2 bg-bg px-2 py-1.5">
          <small className="block text-[9px] uppercase tracking-wider text-dim">Slippage</small>
          <input type="number" className="w-full bg-transparent text-xs font-semibold outline-none" value={s.slippagePct} onChange={(e) => s.set({ slippagePct: Number(e.target.value) })} />
        </div>
        <div className="rounded-md border border-line2 bg-bg px-2 py-1.5">
          <small className="block text-[9px] uppercase tracking-wider text-dim">Prio</small>
          <b className="text-xs">{preset.priorityFeeSol}</b>
        </div>
        <div className="rounded-md border border-line2 bg-bg px-2 py-1.5">
          <small className="block text-[9px] uppercase tracking-wider text-dim">Tip Jito</small>
          <b className="text-xs">{s.mevProtect ? preset.jitoTipSol : 0}</b>
        </div>
        <button onClick={() => s.set({ mevProtect: !s.mevProtect })} className="rounded-md border border-line2 bg-bg px-2 py-1.5 text-left">
          <small className="block text-[9px] uppercase tracking-wider text-dim">MEV</small>
          <b className={`text-xs ${s.mevProtect ? "text-up" : "text-dim"}`}>{s.mevProtect ? "On" : "Off"}</b>
        </button>
      </div>

      <button
        onClick={() => void go()}
        disabled={!ready || busy || (side === "buy" ? !amount : !position?.tokens)}
        className={`w-full rounded-lg py-2.5 text-[13px] font-extrabold text-bg transition disabled:opacity-40 ${side === "buy" ? "bg-up hover:brightness-110" : "bg-dn hover:brightness-110"}`}
      >
        {busy ? "…" : side === "buy" ? `BUY ${amount} SOL — ${token.symbol || "token"}` : `SELL ${sellPct}% — ${token.symbol || "token"}`}
        <small className="block text-[10px] font-semibold opacity-75">
          {preset.label} · {s.mevProtect ? "MEV protect" : "RPC direct"} · {token.stage === "migrated" ? "PumpSwap" : "bonding curve"}
        </small>
      </button>
      {!ready && <p className="mt-1.5 text-center text-[11px] text-warn">Déverrouille un wallet pour trader.</p>}
      {err && <p className="mt-1.5 text-[11px] text-dn">{err}</p>}
      {status && <p className="mt-1.5 text-[11px] text-mut">{status}</p>}
      {last && (
        <a href={`https://solscan.io/tx/${last.signature}`} target="_blank" rel="noreferrer" className="mt-1 block text-[11px] text-acc2 hover:underline">
          Dernière tx ({last.sentVia}) ↗
        </a>
      )}

      <div className="mt-2 flex justify-between text-[10.5px] text-dim">
        <span>
          Frais plateforme <b className="font-semibold text-up">{PLATFORM_FEE_BPS / 100}%</b> ({fmtSol(fees.ours, 4)} SOL)
        </span>
        <span>{COMPETITOR_FEES.slice(0, 2).map((c) => `${c.name} ${fmtSol(fees.competitors.find((x) => x.name === c.name)?.fee ?? 0, 4)}`).join(" · ")}</span>
      </div>
    </div>
  );
}
