"use client";
import { useMemo } from "react";
import { selectColumns, useTokenStore } from "@/lib/store/tokens";
import { useFilters } from "@/lib/store/filters";
import { useMarket } from "@/lib/store/market";
import { useNow } from "@/lib/hooks/useNow";
import type { TrackedToken } from "@/lib/pump/types";
import type { ColumnId } from "@/lib/filters/types";
import { passesFilters } from "@/lib/filters/apply";
import { TokenRow } from "./TokenRow";
import { TrenchSidebar } from "./TrenchSidebar";
import { HoldingsPanel } from "./HoldingsPanel";
import { FilterPopover } from "./FilterPopover";
import { DisplayPopover } from "./DisplayPopover";

function useFiltered(column: ColumnId, list: TrackedToken[], now: number): TrackedToken[] {
  const larpMap = useTokenStore((s) => s.larp);
  const f = useFilters((s) => s.filters[column]);
  const rows = useFilters((s) => s.display.rowsPerColumn);
  const solUsd = useMarket((s) => s.solUsd);
  return useMemo(() => {
    const out: TrackedToken[] = [];
    for (const t of list) {
      if (passesFilters(t, f, { now, solUsd, larp: larpMap.get(t.mint) })) out.push(t);
      if (out.length >= rows) break;
    }
    return out;
  }, [list, f, rows, solUsd, larpMap, now]);
}

function Column({ id, title, icon, hint, list, now }: { id: ColumnId; title: string; icon: string; hint?: string; list: TrackedToken[]; now: number }) {
  const filtered = useFiltered(id, list, now);
  return (
    <section className="flex min-h-0 flex-col border-r border-line last:border-r-0">
      <h3 className="flex items-center gap-2 border-b border-line bg-panel px-3 py-1.5 text-xs font-bold">
        <span>{icon}</span>
        {title}
        <span className="font-medium text-mut">
          {filtered.length}
          {filtered.length !== list.length && <span className="text-dim">/{list.length}</span>}
        </span>
        {hint && <span className="ml-1 text-[11px] font-medium text-dim">{hint}</span>}
        <span className="ml-auto">
          <FilterPopover column={id} />
        </span>
      </h3>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.map((t) => (
          <TokenRow key={t.mint} token={t} now={now} />
        ))}
        {filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-dim">
            {list.length === 0 ? "En attente d'événements on-chain…" : "Tout est filtré — assouplis les filtres de cette colonne."}
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
  const now = useNow(1000);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cols = useMemo(() => selectColumns(tokens), [version, tokens]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[232px_1fr]">
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
          <span className="pill" title="Bientôt : Bonk (LaunchLab), Believe, Moonshot…">
            + autres launchpads <b className="text-dim">bientôt</b>
          </span>
          <div className="ml-auto flex items-center gap-3.5 text-mut">
            <span className="inline-flex items-center gap-1.5">
              <i className={`h-[7px] w-[7px] rounded-full ${status === "live" ? "bg-up shadow-[0_0_8px_var(--color-up)]" : "bg-warn"}`} />
              {status === "live" ? "Live" : status} · slot {lastSlot ? lastSlot.toLocaleString("fr-FR") : "—"}
            </span>
            <DisplayPopover />
            <button className="btn-ghost !py-0.5" onClick={() => setPaused(!paused)}>
              {paused ? "▶ Reprendre" : "⏸ Pause"}
            </button>
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-3">
          <Column id="new" title="New" icon="🆕" hint={paused ? "pause" : "live"} list={cols.fresh} now={now} />
          <Column id="bonding" title="Almost bonded" icon="🔥" hint="tri : % bond" list={cols.bonding} now={now} />
          <Column id="migrated" title="Migrated" icon="🚀" hint="PumpSwap" list={cols.migrated} now={now} />
        </div>

        <HoldingsPanel />
      </div>
    </div>
  );
}
