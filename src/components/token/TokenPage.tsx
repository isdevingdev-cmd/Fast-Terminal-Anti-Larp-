"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTokenStore } from "@/lib/store/tokens";
import { useMarket } from "@/lib/store/market";
import { requestMetadata } from "@/lib/feed/metadataLoader";
import { backfillToken } from "@/lib/feed/backfill";
import { useLarp } from "@/lib/larpcheck/client";
import { extractGithub } from "@/lib/pump/metadata";
import { marketCapSol, priceSol } from "@/lib/pump/curve";
import type { TrackedToken } from "@/lib/pump/types";
import { fmtCompact, fmtPrice, fmtUsd, shortAddr, timeAgo } from "@/lib/format";
import { isValidPublicKey } from "@/lib/base58";
import { TierBadge } from "@/components/larp/TierBadge";
import { LarpPanel } from "@/components/larp/LarpPanel";
import { TradePanel } from "@/components/trade/TradePanel";
import { TokenChart } from "./TokenChart";
import { TradesTable } from "./TradesTable";
import { BondingPanel, DevPanel, DistributionPanel, SecurityPanel } from "./SidePanels";

export function TokenPage({ mint }: { mint: string }) {
  const valid = isValidPublicKey(mint);
  const ensureToken = useTokenStore((s) => s.ensureToken);
  const select = useTokenStore((s) => s.select);
  const version = useTokenStore((s) => s.version);
  const token = useTokenStore((s) => s.tokens.get(mint));
  const solUsd = useMarket((s) => s.solUsd);
  const larp = useLarp(token);
  const [tab, setTab] = useState<"trades" | "holders">("trades");
  const [copied, setCopied] = useState(false);
  void version;

  useEffect(() => {
    if (!valid) return;
    ensureToken(mint);
    select(mint);
    requestMetadata(mint);
    void backfillToken(mint);
    return () => select(null);
  }, [mint, valid, ensureToken, select]);

  if (!valid) return <div className="p-6 text-sm text-dn">Adresse de token invalide.</div>;
  if (!token) return <div className="p-6 text-sm text-mut">Chargement…</div>;

  const github = extractGithub(token.metadata);
  const price = priceSol(token.virtualSolReserves, token.virtualTokenReserves);
  const mcUsd = token.marketCapSol * solUsd;
  const md = token.metadata;
  const last5m = token.recentTrades.filter((t) => Date.now() - t.timestamp * 1000 < 5 * 60_000);
  const first5m = last5m[0];
  const chg5m = first5m ? (token.marketCapSol / Math.max(1e-9, marketCapSol(first5m.virtualSolReserves, first5m.virtualTokenReserves)) - 1) * 100 : 0;

  return (
    <div className="grid h-full min-h-0 grid-rows-[64px_1fr]">
      {/* header */}
      <div className="flex items-center gap-3.5 border-b border-line bg-panel px-4">
        <Link href="/" className="rounded-md border border-line2 px-2 py-1.5 text-xs text-mut hover:text-txt">
          ← Trenches
        </Link>
        {md?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={md.image} alt="" className="h-[42px] w-[42px] rounded-[11px] object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-[42px] w-[42px] rounded-[11px] bg-gradient-to-br from-line2 to-panel2" />
        )}
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[17px] font-extrabold">
            {token.symbol || shortAddr(mint)}
            <span className="truncate text-[13px] font-medium text-mut">{token.name}</span>
            <TierBadge entry={larp} size="md" />
            {token.stage === "migrated" ? <span className="flag flag-c">PumpSwap</span> : <span className="flag flag-p">pump.fun</span>}
            {token.devSold && <span className="flag flag-b">DEV SOLD</span>}
          </h1>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-dim">
            <button
              className="font-mono hover:text-txt"
              onClick={() => {
                void navigator.clipboard.writeText(mint);
                setCopied(true);
                setTimeout(() => setCopied(false), 1000);
              }}
            >
              {shortAddr(mint, 6)} {copied ? "✓" : "⧉"}
            </button>
            {md?.twitter && <a className="rounded border border-line2 px-1.5" href={md.twitter} target="_blank" rel="noreferrer">𝕏</a>}
            {md?.telegram && <a className="rounded border border-line2 px-1.5" href={md.telegram} target="_blank" rel="noreferrer">Telegram</a>}
            {md?.website && <a className="rounded border border-line2 px-1.5" href={md.website} target="_blank" rel="noreferrer">Site</a>}
            {github && <a className="rounded border border-cyan/30 px-1.5 text-cyan" href={github} target="_blank" rel="noreferrer">GitHub</a>}
            <a className="rounded border border-line2 px-1.5" href={`https://pump.fun/coin/${mint}`} target="_blank" rel="noreferrer">pump.fun</a>
            <a className="rounded border border-line2 px-1.5" href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer">Solscan</a>
            <span>· créé {timeAgo(token.createdAt)}</span>
          </div>
        </div>
        <div className="ml-3 flex h-full border-l border-line">
          {[
            ["Market cap", solUsd ? fmtUsd(mcUsd) : `${fmtCompact(token.marketCapSol)} SOL`, true],
            ["Prix", solUsd ? `$${fmtPrice(price * solUsd)}` : `${fmtPrice(price)} SOL`],
            ["Vol (session)", solUsd ? fmtUsd(token.volumeSol * solUsd) : `${fmtCompact(token.volumeSol)} SOL`],
            ["Trades", String(token.tradeCount)],
            ["Traders", String(token.traders.size)],
            ["5m", `${chg5m >= 0 ? "+" : ""}${chg5m.toFixed(0)}%`],
          ].map(([k, v, big]) => (
            <div key={k as string} className="flex flex-col justify-center border-r border-line px-4">
              <small className="text-[9.5px] uppercase tracking-wider text-dim">{k}</small>
              <b className={`${big ? "text-lg" : "text-sm"} font-bold ${k === "5m" ? (chg5m >= 0 ? "text-up" : "text-dn") : ""}`}>{v}</b>
            </div>
          ))}
        </div>
      </div>

      {/* body */}
      <div className="grid min-h-0 grid-cols-[272px_1fr_400px]">
        <aside className="min-h-0 overflow-y-auto border-r border-line bg-panel">
          <SecurityPanel token={token} />
          <BondingPanel token={token} />
          <DevPanel token={token} />
          <DistributionPanel token={token} />
        </aside>

        <section className="grid min-h-0 grid-rows-[1fr_280px]">
          <div className="min-h-0 border-b border-line">
            <TokenChart token={token} />
          </div>
          <div className="flex min-h-0 flex-col bg-panel">
            <h3 className="flex h-9 items-center gap-1 border-b border-line px-2.5 text-xs">
              <button onClick={() => setTab("trades")} className={`rounded px-2 py-1 ${tab === "trades" ? "bg-panel2 font-bold text-txt" : "text-mut"}`}>
                Trades
              </button>
              <button onClick={() => setTab("holders")} className={`rounded px-2 py-1 ${tab === "holders" ? "bg-panel2 font-bold text-txt" : "text-mut"}`}>
                Top traders
              </button>
              <span className="ml-auto flag flag-g">▮ live</span>
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto">{tab === "trades" ? <TradesTable token={token} /> : <TopTraders token={token} />}</div>
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-line bg-panel">
          <TradePanel token={token} />
          <LarpPanel token={token} entry={larp} />
        </aside>
      </div>
    </div>
  );
}

function TopTraders({ token }: { token: TrackedToken }) {
  const agg = new Map<string, { bought: number; sold: number; tokens: bigint }>();
  for (const t of token.recentTrades) {
    const a = agg.get(t.user) ?? { bought: 0, sold: 0, tokens: 0n };
    const sol = Number(t.solAmount) / 1e9;
    if (t.isBuy) {
      a.bought += sol;
      a.tokens += t.tokenAmount;
    } else {
      a.sold += sol;
      a.tokens -= t.tokenAmount;
    }
    agg.set(t.user, a);
  }
  const rows = [...agg.entries()].sort((x, y) => y[1].bought - x[1].bought).slice(0, 50);
  return (
    <table className="w-full border-collapse text-[11.5px]">
      <thead className="sticky top-0 bg-panel">
        <tr className="text-[10px] uppercase tracking-wider text-dim">
          <th className="px-3 py-1.5 text-left font-semibold">Wallet</th>
          <th className="px-3 py-1.5 text-right font-semibold">Acheté</th>
          <th className="px-3 py-1.5 text-right font-semibold">Vendu</th>
          <th className="px-3 py-1.5 text-right font-semibold">Net SOL</th>
          <th className="px-3 py-1.5 text-right font-semibold">Holding</th>
          <th className="px-3 py-1.5 text-left font-semibold" />
        </tr>
      </thead>
      <tbody>
        {rows.map(([user, a]) => (
          <tr key={user} className="border-t border-line">
            <td className="px-3 py-1.5 font-mono text-mut">{shortAddr(user, 5)}</td>
            <td className="px-3 py-1.5 text-right text-up">{a.bought.toFixed(2)}</td>
            <td className="px-3 py-1.5 text-right text-dn">{a.sold.toFixed(2)}</td>
            <td className={`px-3 py-1.5 text-right ${a.sold - a.bought >= 0 ? "text-up" : "text-dn"}`}>{(a.sold - a.bought).toFixed(2)}</td>
            <td className="px-3 py-1.5 text-right">{(Number(a.tokens) / 1e13).toFixed(2)} %</td>
            <td className="px-3 py-1.5">{token.creator === user && <span className="flag flag-p">DEV</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
