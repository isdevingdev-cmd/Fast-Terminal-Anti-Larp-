"use client";
import { useEffect, useRef, useState } from "react";
import { useFilters } from "@/lib/store/filters";
import type { ColumnFilters, ColumnId } from "@/lib/filters/types";
import { activeFilterCount } from "@/lib/filters/apply";
import { TIER_ORDER, type LarpTier } from "@/lib/larpcheck/types";

const COLUMN_LABEL: Record<ColumnId, string> = { new: "New", bonding: "Almost bonded", migrated: "Migrated" };

function Num({ label, value, onChange, unit, step = 1 }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; unit?: string; step?: number }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1 text-mut">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          className="w-20 rounded border border-line2 bg-bg px-1.5 py-0.5 text-right text-txt outline-none focus:border-acc"
          value={value ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
        {unit && <span className="w-6 text-[10px] text-dim">{unit}</span>}
      </span>
    </label>
  );
}

function Bool({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1 text-mut">
      <span>{label}</span>
      <button type="button" onClick={() => onChange(!value)} className={`relative h-[14px] w-[26px] rounded-full transition ${value ? "bg-acc" : "bg-line2"}`} aria-pressed={value}>
        <i className={`absolute top-[2px] h-[10px] w-[10px] rounded-full transition-all ${value ? "left-[14px] bg-white" : "left-[2px] bg-dim"}`} />
      </button>
    </label>
  );
}

export function FilterPopover({ column }: { column: ColumnId }) {
  const f = useFilters((s) => s.filters[column]);
  const setFilter = useFilters((s) => s.setFilter);
  const resetFilters = useFilters((s) => s.resetFilters);
  const copyFilters = useFilters((s) => s.copyFilters);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"metrics" | "socials" | "larp">("metrics");
  const ref = useRef<HTMLDivElement>(null);
  const count = activeFilterCount(f);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const set = (patch: Partial<ColumnFilters>) => setFilter(column, patch);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={`rounded px-2 py-0.5 text-[11px] font-semibold ${count ? "bg-acc/15 text-acc2" : "text-dim hover:text-txt"}`}>
        ⚲ Filtres{count ? ` (${count})` : ""}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[300px] rounded-lg border border-line2 bg-panel p-3 text-[11.5px] shadow-2xl">
          <div className="mb-2 flex items-center gap-1">
            <b className="text-xs">{COLUMN_LABEL[column]}</b>
            <span className="ml-auto flex gap-0.5 rounded-md border border-line2 bg-bg p-0.5">
              {(["metrics", "socials", "larp"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-0.5 text-[10.5px] font-semibold ${tab === t ? "bg-acc/15 text-acc2" : "text-mut"}`}>
                  {t === "metrics" ? "Métriques" : t === "socials" ? "Socials" : "LarpCheck"}
                </button>
              ))}
            </span>
          </div>

          {tab === "metrics" && (
            <div>
              <Num label="MC min" value={f.mcMinUsd} onChange={(v) => set({ mcMinUsd: v })} unit="$" step={1000} />
              <Num label="MC max" value={f.mcMaxUsd} onChange={(v) => set({ mcMaxUsd: v })} unit="$" step={1000} />
              <Num label="Âge min" value={f.ageMinMin} onChange={(v) => set({ ageMinMin: v })} unit="min" />
              <Num label="Âge max" value={f.ageMaxMin} onChange={(v) => set({ ageMaxMin: v })} unit="min" />
              <Num label="Traders min" value={f.tradersMin} onChange={(v) => set({ tradersMin: v })} />
              <Num label="Tx min" value={f.txMin} onChange={(v) => set({ txMin: v })} />
              <Num label="Volume min" value={f.volMinUsd} onChange={(v) => set({ volMinUsd: v })} unit="$" step={100} />
              <Num label="Dev max" value={f.devMaxPct} onChange={(v) => set({ devMaxPct: v })} unit="%" />
              <Num label="Bundle max" value={f.bundleMaxPct} onChange={(v) => set({ bundleMaxPct: v })} unit="%" />
              <Num label="Bonding min" value={f.bondMin} onChange={(v) => set({ bondMin: v })} unit="%" />
              <Num label="Bonding max" value={f.bondMax} onChange={(v) => set({ bondMax: v })} unit="%" />
              <Bool label="Masquer dev a vendu" value={f.hideDevSold} onChange={(v) => set({ hideDevSold: v })} />
              <Bool label="Masquer âge inconnu" value={f.hideUnknownAge} onChange={(v) => set({ hideUnknownAge: v })} />
              <Bool label="Masquer Mayhem" value={f.hideMayhem} onChange={(v) => set({ hideMayhem: v, onlyMayhem: v ? false : f.onlyMayhem })} />
              <Bool label="Mayhem uniquement" value={f.onlyMayhem} onChange={(v) => set({ onlyMayhem: v, hideMayhem: v ? false : f.hideMayhem })} />
            </div>
          )}

          {tab === "socials" && (
            <div>
              <Bool label="𝕏 requis" value={f.requireTwitter} onChange={(v) => set({ requireTwitter: v })} />
              <Bool label="Telegram requis" value={f.requireTelegram} onChange={(v) => set({ requireTelegram: v })} />
              <Bool label="Site requis" value={f.requireWebsite} onChange={(v) => set({ requireWebsite: v })} />
              <Bool label="Au moins un social" value={f.requireAnySocial} onChange={(v) => set({ requireAnySocial: v })} />
              <Bool label="Image requise" value={f.requireImage} onChange={(v) => set({ requireImage: v })} />
              <Bool label="GitHub requis" value={f.requireGithub} onChange={(v) => set({ requireGithub: v })} />
              <label className="mt-1 block text-mut">
                Mots-clés à inclure <span className="text-dim">(virgules)</span>
                <input className="input mt-1 !py-1 !text-xs" value={f.keywordsInclude} onChange={(e) => set({ keywordsInclude: e.target.value })} placeholder="ai, agent, cat" />
              </label>
              <label className="mt-1.5 block text-mut">
                Mots-clés à exclure
                <input className="input mt-1 !py-1 !text-xs" value={f.keywordsExclude} onChange={(e) => set({ keywordsExclude: e.target.value })} placeholder="test, rug" />
              </label>
            </div>
          )}

          {tab === "larp" && (
            <div>
              <label className="flex items-center justify-between py-1 text-mut">
                Tier minimum
                <select className="rounded border border-line2 bg-bg px-1 py-0.5 text-txt" value={f.larpMinTier ?? ""} onChange={(e) => set({ larpMinTier: (e.target.value || null) as LarpTier | null })}>
                  <option value="">aucun</option>
                  {TIER_ORDER.slice(0, 5).map((t) => (
                    <option key={t} value={t}>
                      {t} et +
                    </option>
                  ))}
                </select>
              </label>
              <Bool label="Masquer « Full LARP »" value={f.hideFullLarp} onChange={(v) => set({ hideFullLarp: v })} />
              <p className="mt-2 text-[10px] leading-snug text-dim">
                Le scan LarpCheck se lance à l&apos;ouverture d&apos;un token. Ces filtres ne s&apos;appliquent qu&apos;aux tokens déjà scannés ; « GitHub requis » (onglet Socials)
                filtre sans scan.
              </p>
            </div>
          )}

          <div className="mt-3 flex gap-1.5">
            <button className="btn-ghost flex-1 !py-1" onClick={() => resetFilters(column)}>
              Réinitialiser
            </button>
            <button
              className="btn-ghost flex-1 !py-1"
              title="Appliquer ces filtres aux deux autres colonnes"
              onClick={() => copyFilters(column, (["new", "bonding", "migrated"] as ColumnId[]).filter((c) => c !== column))}
            >
              Copier partout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
