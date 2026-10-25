"use client";
import Link from "next/link";
import { memo, useEffect } from "react";
import { requestMetadata } from "@/lib/feed/metadataLoader";
import type { TrackedToken } from "@/lib/pump/types";
import { fmtCompact, fmtUsd, shortAddr, timeAgo } from "@/lib/format";
import { useMarket } from "@/lib/store/market";
import { useFilters } from "@/lib/store/filters";
import { useTokenStore } from "@/lib/store/tokens";
import { TokenImage } from "@/components/ui/TokenImage";
import { extractGithub } from "@/lib/pump/metadata";
import { TierBadge } from "@/components/larp/TierBadge";
import { QuickBuyButton } from "@/components/trade/QuickBuyButton";

export const TokenRow = memo(function TokenRow({ token, now }: { token: TrackedToken; now: number }) {
  const solUsd = useMarket((s) => s.solUsd);
  const display = useFilters((s) => s.display);
  const showUsd = display.showUsd;
  // LarpCheck is scanned when the token page is opened; rows only show a result that already exists.
  const larp = useTokenStore((s) => s.larp.get(token.mint));
  const github = extractGithub(token.metadata);
  useEffect(() => {
    if (token.metadataStatus === "idle") requestMetadata(token.mint);
  }, [token.mint, token.metadataStatus]);
  const mc = showUsd && solUsd ? fmtUsd(token.marketCapSol * solUsd) : `${fmtCompact(token.marketCapSol)} SOL`;
  const vol = showUsd && solUsd ? fmtUsd(token.volumeSol * solUsd) : `${fmtCompact(token.volumeSol)} SOL`;
  const devPct = token.creatorTokenUnits > 0n ? Number(token.creatorTokenUnits) / 1e13 : 0; // % of 1e15 units
  const bundlePct = token.bundleShare * 100;
  const last = token.recentTrades[token.recentTrades.length - 1];
  const flash = display.flashOnTrade && last && now - last.receivedAt < 800 ? (last.isBuy ? "flash-up" : "flash-dn") : "";
  const compact = display.density === "compact";

  return (
    <Link
      href={`/token/${token.mint}`}
      className={`grid gap-2.5 border-b border-line px-3 transition-colors hover:bg-panel2 ${compact ? "grid-cols-[28px_1fr_auto] py-1" : "grid-cols-[36px_1fr_auto] py-2"} ${flash}`}
    >
      {display.showImages ? <TokenImage src={token.metadata?.image} size={compact ? 28 : 36} /> : <span />}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] font-bold">
          <span className="truncate">{token.symbol || shortAddr(token.mint)}</span>
          <span className="truncate font-medium text-mut">{token.name}</span>
          <span className="ml-auto flex-none text-[11px] font-medium text-dim" title={token.createdKnown ? "Âge depuis la création on-chain" : "Créé avant ta connexion — âge inconnu"}>
            {token.createdKnown ? timeAgo(token.createdAt, now) : "ancien"}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] text-dim">
          {token.mayhem && <span className="flag flag-w" title="Mayhem mode : un agent IA pump.fun trade ce coin pendant 24 h (2 Md de supply)">MAYHEM</span>}
          {token.devSold && <span className="flag flag-b">DEV SOLD</span>}
          {bundlePct > 30 && <span className="flag flag-b">BUNDLE {bundlePct.toFixed(0)}%</span>}
          {bundlePct > 15 && bundlePct <= 30 && <span className="flag flag-w">BUNDLE {bundlePct.toFixed(0)}%</span>}
          {devPct > 10 && <span className="flag flag-b">DEV {devPct.toFixed(0)}%</span>}
          <em className="not-italic text-mut">👥 {token.traders.size}</em>
          <em className="not-italic text-mut">dev {devPct.toFixed(1)}%</em>
          {token.metadata?.twitter && <em className="not-italic">𝕏</em>}
          {token.metadata?.telegram && <em className="not-italic">TG</em>}
          {token.metadata?.website && <em className="not-italic">🌐</em>}
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
        {token.stage !== "migrated" && !compact && (
          <div className="mt-1.5 h-[3px] overflow-hidden rounded bg-line2">
            <i className="block h-full bg-gradient-to-r from-acc to-cyan" style={{ width: `${Math.round(token.bondingProgress * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between gap-1">
        {larp ? <TierBadge entry={larp} /> : github ? <span className="flag flag-c" title="Repo GitHub trouvé — scan LarpCheck à l'ouverture">LARP ?</span> : <span className="flag flag-n" title="Pas de GitHub dans les metadata">no GH</span>}
        {display.quickBuyOnRows && <QuickBuyButton token={token} />}
      </div>
    </Link>
  );
});
