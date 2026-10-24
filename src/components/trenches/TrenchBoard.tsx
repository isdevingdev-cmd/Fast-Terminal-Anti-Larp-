"use client";
import { useMemo } from "react";
import { selectColumns, useTokenStore } from "@/lib/store/tokens";
import { useSettings } from "@/lib/store/settings";
import { useNow } from "@/lib/hooks/useNow";
import type { TrackedToken } from "@/lib/pump/types";
import { isReport } from "@/lib/larpcheck/client";
import { tierAtLeast } from "@/lib/larpcheck/types";
import { extractGithub } from "@/lib/pump/metadata";
import { TokenRow } from "./TokenRow";
import { TrenchSidebar } from "./TrenchSidebar";
import { HoldingsPanel } from "./HoldingsPanel";
import { fmtCompact } from "@/lib/format";

const PER_COLUMN = 40;

function useFiltered(list: TrackedToken[]): TrackedToken[] {
  const larpMap = useTokenStore((s) => s.larp);
  const f = useSettings((s) => s.larp);
  const minMc = useSettings((s) => s.minMarketCapSol);
  return useMemo(
    () =>
      list
        .filter((t) => {
          if (t.marketCapSol < minMc) return false;
          if (f.hideBundled && t.bundleShare > 0.3) return false;
          if (f.hideDevHeavy && Number(t.creatorTokenUnits) / 1e13 > 10) return false;
          const entry = larpMap.get(t.mint);
          const gh = extractGithub(t.metadata);
          if (f.requireGithub && !gh) return false;
          if (isReport(entry) && !entry.error) {
            if (f.hideFullLarp && entry.tier === "F") return false;
            if (f.minTier && !tierAtLeast(entry.tier, f.minTier)) return false;
          } else if (f.minTier && t.metadataStatus === "done" && !gh) {
            return false; // a tier floor implies "must be scannable"
          }
          return true;
        })
        .slice(0, PER_COLUMN),
    [list, larpMap, f, minMc],
  );
}

function Column({ title, icon, hint, list, now }: { title: string; icon: string; hint?: string; list: TrackedToken[]; now: number }) {
  const filtered = useFiltered(list);
  return (
    <section className="flex min-h-0 flex-col border-r border-line last:border-r-0">
      <h3 className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2 text-xs font-bold">
        <span>{icon}</span>
        {title}
        <span className="font-medium text-mut">{list.length}</span>
        {hint && <span className="ml-auto text-[11px] font-medium text-dim">{hint}</span>}
      </h3>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.map((t) => (
          <TokenRow key={t.mint} token={t} now={now} />
        ))}
        {filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-dim">
            {list.length === 0 ? "En attente d'événements on-chain…" : "Tout est filtré — assouplis les filtres LarpCheck."}
          </p>
        )}
      </div>
    </section>
  );
}

export function TrenchBoard() {
  const version = useTokenStore((s) => s.version);
  const tokens = useTokenStore((s) => s.tokens);
  const paused = useTokenStore((s) => s.paused);
  const setPaused = useTokenStore((s) => s.setPaused);
  const status = useTokenStore((s) => s.feedStatus);
  const lastSlot = useTokenStore((s) => s.lastSlot);
  const minMc = useSettings((s) => s.minMarketCapSol);
  const setSettings = useSettings((s) => s.set);
  const now = useNow(1000);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cols = useMemo(() => selectColumns(tokens), [version, tokens]);

  return (
    <div className="grid h-full grid-cols-[232px_1fr] min-h-0">
      <TrenchSidebar />
      <div className="grid min-h-0 grid-rows-[38px_1fr_220px]">
        <div className="flex items-center gap-2.5 border-b border-line bg-panel px-3.5">
          <div className="flex gap-0.5">
            <span className="rounded-md bg-panel2 px-2.5 py-1 font-semibold text-txt shadow-[inset_0_0_0_1px_var(--color-line2)]">SOL</span>
            <span className="px-2.5 py-1 font-semibold text-dim" title="Bientôt">
              BASE
            </span>
            <span className="px-2.5 py-1 font-semibold text-dim" title="Bientôt">
              BNB
            </span>
          </div>
          <span className="pill">
            pump.fun <b className="text-txt">· on-chain direct</b>
          </span>
          <div className="ml-auto flex items-center gap-3.5 text-mut">
            <span className="inline-flex items-center gap-1.5">
              <i className={`h-[7px] w-[7px] rounded-full ${status === "live" ? "bg-up shadow-[0_0_8px_var(--color-up)]" : "bg-warn"}`} />
              {status === "live" ? "Live" : status} · slot {lastSlot ? lastSlot.toLocaleString("fr-FR") : "—"}
            </span>
            <label className="inline-flex items-center gap-1.5">
              MC &gt;
              <select className="rounded border border-line2 bg-bg px-1 py-0.5 text-txt" value={minMc} onChange={(e) => setSettings({ minMarketCapSol: Number(e.target.value) })}>
                {[0, 30, 50, 100, 200, 500].map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? "tout" : `${fmtCompact(v)} SOL`}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-ghost !py-0.5" onClick={() => setPaused(!paused)}>
              {paused ? "▶ Reprendre" : "⏸ Pause"}
            </button>
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-3">
          <Column title="New" icon="🆕" hint={paused ? "pause" : "live"} list={cols.fresh} now={now} />
          <Column title="Almost bonded" icon="🔥" hint="tri : % bond" list={cols.bonding} now={now} />
          <Column title="Migrated" icon="🚀" hint="PumpSwap" list={cols.migrated} now={now} />
        </div>

        <HoldingsPanel />
      </div>
    </div>
  );
}
