"use client";
import Link from "next/link";
import { memo } from "react";
import type { TrackedToken } from "@/lib/pump/types";
import { fmtCompact, fmtUsd, shortAddr, timeAgo } from "@/lib/format";
import { useMarket } from "@/lib/store/market";
import { useSettings } from "@/lib/store/settings";
import { useLarp } from "@/lib/larpcheck/client";
import { extractGithub } from "@/lib/pump/metadata";
import { TierBadge } from "@/components/larp/TierBadge";
import { QuickBuyButton } from "@/components/trade/QuickBuyButton";

function TokenImage({ token, size = 36 }: { token: TrackedToken; size?: number }) {
  const img = token.metadata?.image;
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-full w-full rounded-[9px] object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="h-full w-full rounded-[9px] bg-gradient-to-br from-line2 to-panel2" />
      )}
    </div>
  );
}

export const TokenRow = memo(function TokenRow({ token, now }: { token: TrackedToken; now: number }) {
  const solUsd = useMarket((s) => s.solUsd);
  const showUsd = useSettings((s) => s.showUsd);
  const larp = useLarp(token);
  const github = extractGithub(token.metadata);
  const mc = showUsd && solUsd ? fmtUsd(token.marketCapSol * solUsd) : `${fmtCompact(token.marketCapSol)} SOL`;
  const vol = showUsd && solUsd ? fmtUsd(token.volumeSol * solUsd) : `${fmtCompact(token.volumeSol)} SOL`;
  const devPct = token.creatorTokenUnits > 0n ? Number(token.creatorTokenUnits) / 1e13 : 0; // % of 1e15 units
  const bundlePct = token.bundleShare * 100;
  const last = token.recentTrades[token.recentTrades.length - 1];
  const flash = last && now - last.receivedAt < 800 ? (last.isBuy ? "flash-up" : "flash-dn") : "";

  return (
    <Link
      href={`/token/${token.mint}`}
      className={`grid grid-cols-[36px_1fr_auto] gap-2.5 border-b border-line px-3 py-2 transition-colors hover:bg-panel2 ${flash}`}
    >
      <TokenImage token={token} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] font-bold">
          <span className="truncate">{token.symbol || shortAddr(token.mint)}</span>
          <span className="truncate font-medium text-mut">{token.name}</span>
          <span className="ml-auto flex-none text-[11px] font-medium text-dim">{timeAgo(token.createdAt, now)}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] text-dim">
          {token.devSold && <span className="flag flag-b">DEV SOLD</span>}
          {bundlePct > 30 && <span className="flag flag-b">BUNDLE {bundlePct.toFixed(0)}%</span>}
          {bundlePct > 15 && bundlePct <= 30 && <span className="flag flag-w">BUNDLE {bundlePct.toFixed(0)}%</span>}
          {devPct > 10 && <span className="flag flag-b">DEV {devPct.toFixed(0)}%</span>}
          <em className="not-italic text-mut">👥 {token.traders.size}</em>
          <em className="not-italic text-mut">dev {devPct.toFixed(1)}%</em>
          {token.metadata?.twitter && <em className="not-italic">𝕏</em>}
          {token.metadata?.telegram && <em className="not-italic">TG</em>}
          {token.metadata?.website && <em className="not-italic">🌐</em>}
          {github && <span className="flag flag-c">GitHub</span>}
        </div>
        <div className="mt-1.5 flex gap-3 text-[11px] text-mut">
          <div>
            MC <b className="block text-[11.5px] font-semibold text-txt">{mc}</b>
          </div>
          <div>
            Vol <b className="block text-[11.5px] font-semibold text-txt">{vol}</b>
          </div>
          <div>
            Tx <b className="block text-[11.5px] font-semibold text-txt">{token.tradeCount}</b>
          </div>
          <div>
            B/S{" "}
            <b className="block text-[11.5px] font-semibold">
              <span className="text-up">{token.buyCount}</span>
              <span className="text-dim">/</span>
              <span className="text-dn">{token.sellCount}</span>
            </b>
          </div>
        </div>
        {token.stage !== "migrated" && (
          <div className="mt-1.5 h-[3px] overflow-hidden rounded bg-line2">
            <i className="block h-full bg-gradient-to-r from-acc to-cyan" style={{ width: `${Math.round(token.bondingProgress * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between gap-1">
        <TierBadge entry={larp} />
        <QuickBuyButton token={token} />
      </div>
    </Link>
  );
});
