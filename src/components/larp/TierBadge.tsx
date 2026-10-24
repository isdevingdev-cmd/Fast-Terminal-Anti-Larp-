"use client";
import type { LarpEntry } from "@/lib/larpcheck/client";
import { isReport } from "@/lib/larpcheck/client";
import type { LarpTier } from "@/lib/larpcheck/types";

export const TIER_COLOR: Record<LarpTier, string> = {
  S: "var(--color-tier-s)",
  A: "var(--color-tier-a)",
  B: "var(--color-tier-b)",
  C: "var(--color-tier-c)",
  D: "var(--color-tier-d)",
  F: "var(--color-tier-f)",
};

export function TierBadge({ entry, size = "sm" }: { entry: LarpEntry | undefined; size?: "sm" | "md" }) {
  const pad = size === "md" ? "px-2 py-1 text-[11px]" : "px-1.5 py-0.5 text-[10.5px]";
  if (!entry) {
    return <span className={`inline-flex items-center gap-1 rounded font-bold ${pad} bg-panel2 text-dim`}>…</span>;
  }
  if (!isReport(entry)) {
    if (entry.status === "loading")
      return (
        <span className={`inline-flex items-center gap-1 rounded font-bold ${pad} bg-panel2 text-dim`}>
          <i className="h-2 w-2 animate-pulse rounded-full bg-acc2" /> scan
        </span>
      );
    return (
      <span className={`inline-flex items-center gap-1 rounded font-bold ${pad} bg-panel2 text-dim`} title="Aucun lien GitHub dans les metadata">
        <i className="grid h-3.5 w-3.5 place-items-center rounded-[3px] bg-line2 text-[9px] not-italic text-mut">?</i> no GitHub
      </span>
    );
  }
  if (entry.error) {
    return (
      <span className={`inline-flex items-center gap-1 rounded font-bold ${pad} bg-panel2 text-dim`} title={entry.error}>
        <i className="grid h-3.5 w-3.5 place-items-center rounded-[3px] bg-line2 text-[9px] not-italic text-mut">!</i> erreur
      </span>
    );
  }
  const c = TIER_COLOR[entry.tier];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-extrabold ${pad}`}
      style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
      title={`${entry.verdict} — ${entry.summary}`}
    >
      <i className="grid h-3.5 w-3.5 place-items-center rounded-[3px] text-[9.5px] not-italic text-bg" style={{ background: c }}>
        {entry.tier}
      </i>
      {entry.score.toFixed(1)}
    </span>
  );
}
