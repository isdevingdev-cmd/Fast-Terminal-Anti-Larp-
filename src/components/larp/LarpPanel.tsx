"use client";
import { useState } from "react";
import type { LarpEntry } from "@/lib/larpcheck/client";
import { isReport, scanTokenGithub } from "@/lib/larpcheck/client";
import type { LarpReport } from "@/lib/larpcheck/types";
import { TIER_COLOR } from "./TierBadge";
import type { TrackedToken } from "@/lib/pump/types";
import { timeAgo } from "@/lib/format";
import { useTokenStore } from "@/lib/store/tokens";

function resetLarp(mint: string) {
  const larp = new Map(useTokenStore.getState().larp);
  larp.delete(mint);
  useTokenStore.setState({ larp });
}

function CheckIcon({ status }: { status: LarpReport["checks"][number]["status"] }) {
  const map = { pass: ["✓", "bg-up"], warn: ["!", "bg-warn"], fail: ["×", "bg-dn"], na: ["–", "bg-line2"] } as const;
  const [ch, bg] = map[status];
  return <i className={`grid h-3.5 w-3.5 flex-none place-items-center rounded-full text-[9px] font-black not-italic text-bg ${bg}`}>{ch}</i>;
}

export function ScoreRing({ score, tier }: { score: number; tier: LarpReport["tier"] }) {
  const c = TIER_COLOR[tier];
  const pct = Math.max(0, Math.min(100, score * 10));
  return (
    <div className="relative grid h-[58px] w-[58px] place-items-center rounded-full" style={{ background: `conic-gradient(${c} 0 ${pct}%, var(--color-line2) ${pct}% 100%)` }}>
      <div className="absolute inset-[5px] rounded-full bg-bg" />
      <b className="relative text-base font-extrabold">{score.toFixed(1)}</b>
      <small className="absolute bottom-2 text-[8px] font-semibold text-dim">/10</small>
    </div>
  );
}

export function CommitHeatmap({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <div className="grid grid-cols-[repeat(36,1fr)] gap-[2px]">
      {weeks.map((n, i) => {
        const a = n / max;
        const bg = n === 0 ? "var(--color-line)" : a > 0.75 ? "var(--color-cyan)" : a > 0.4 ? "var(--color-up)" : "rgba(34,197,94,.45)";
        return <i key={i} className="block aspect-square rounded-[2px]" style={{ background: bg }} title={`${n} commits`} />;
      })}
    </div>
  );
}

export function LarpReportView({ report, compact = false }: { report: LarpReport; compact?: boolean }) {
  const c = TIER_COLOR[report.tier];
  return (
    <div>
      <div className="mb-2.5 grid grid-cols-[auto_1fr] items-center gap-3 rounded-lg border border-line2 bg-bg px-3 py-2.5">
        <ScoreRing score={report.score} tier={report.tier} />
        <div>
          <div className="flex items-center gap-2 text-[13px] font-extrabold">
            <i className="rounded px-1.5 text-[11px] not-italic text-bg" style={{ background: c }}>
              {report.tier}
            </i>
            {report.verdict}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-mut">{report.summary}</p>
          {report.repo && (
            <a href={report.repo.url} target="_blank" rel="noreferrer" className="text-[11px] text-cyan hover:underline">
              {report.repo.owner}/{report.repo.name} ↗
            </a>
          )}
        </div>
      </div>
      <div className={`grid gap-1.5 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
        {report.checks.map((ck) => (
          <div key={ck.id} className="flex items-center gap-2 rounded-md border border-line bg-bg px-2 py-1.5">
            <CheckIcon status={ck.status} />
            <div className="min-w-0 leading-tight">
              <b className="block text-[11px] font-semibold">{ck.label}</b>
              <small className="block truncate text-[9.5px] text-dim" title={ck.detail}>
                {ck.detail}
              </small>
            </div>
          </div>
        ))}
      </div>
      {report.weeklyCommits.length > 0 && (
        <div className="mt-2.5 rounded-md border border-line bg-bg px-2.5 py-2">
          <h5 className="mb-1.5 flex justify-between text-[10px] uppercase tracking-wider text-dim">
            Activité GitHub · 36 semaines
            <span className="normal-case tracking-normal text-mut">{report.weeklyCommits.reduce((a, b) => a + b, 0)} commits récents</span>
          </h5>
          <CommitHeatmap weeks={report.weeklyCommits} />
        </div>
      )}
      {report.contributors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {report.contributors.map((ct) => (
            <span key={ct.login} className="rounded-full border border-line bg-bg px-2 py-0.5 text-[10.5px]">
              {ct.login} · {Math.round(ct.share * 100)} %
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function LarpPanel({ token, entry }: { token: TrackedToken; entry: LarpEntry | undefined }) {
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  const rescan = async (gh: string) => {
    setBusy(true);
    resetLarp(token.mint);
    await scanTokenGithub(token.mint, gh, token);
    setBusy(false);
  };

  return (
    <div className="p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-gradient-to-br from-cyan to-acc text-[10px] font-black text-bg">L</span>
        <b className="text-[12.5px]">LarpCheck</b>
        {isReport(entry) && !entry.error && <span className="flag flag-g">dev scanné</span>}
        {isReport(entry) && <span className="ml-auto text-[10px] text-dim">il y a {timeAgo(entry.scannedAt)}</span>}
      </div>

      {!entry && <p className="text-xs text-mut">Chargement des metadata…</p>}
      {entry && !isReport(entry) && entry.status === "loading" && <p className="text-xs text-mut">Scan du GitHub en cours…</p>}
      {entry && !isReport(entry) && entry.status === "none" && (
        <div className="rounded-lg border border-dashed border-line2 bg-bg p-3 text-xs text-mut">
          <p>
            Aucun lien GitHub dans les metadata du token. Un dev qui ne montre pas son code n&apos;est pas forcément un LARP, mais il ne peut pas
            être vérifié.
          </p>
        </div>
      )}
      {isReport(entry) && entry.error && (
        <div className="rounded-lg border border-dn/30 bg-dn/10 p-3 text-xs text-dn">Scan impossible : {entry.error}</div>
      )}
      {isReport(entry) && !entry.error && <LarpReportView report={entry} />}

      <form
        className="mt-3 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) void rescan(manual.trim());
        }}
      >
        <input className="input !py-1.5 !text-xs" placeholder="github.com/owner/repo — scanner manuellement" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn-ghost whitespace-nowrap" disabled={busy}>
          {busy ? "…" : "Scanner"}
        </button>
        {isReport(entry) && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => void rescan(entry.input)} title="Rescanner">
            ↻
          </button>
        )}
      </form>
    </div>
  );
}
