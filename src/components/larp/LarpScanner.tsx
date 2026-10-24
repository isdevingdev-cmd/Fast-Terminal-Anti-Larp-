"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LarpReport } from "@/lib/larpcheck/types";
import { TIER_LABELS, TIER_ORDER } from "@/lib/larpcheck/types";
import { LarpReportView } from "./LarpPanel";
import { TIER_COLOR } from "./TierBadge";

const EXAMPLES = ["torvalds/linux", "elizaOS/eliza", "rckprtr/pumpdotfun-sdk"];

export function LarpScanner() {
  const params = useSearchParams();
  const [input, setInput] = useState(params.get("github") ?? "");
  const [report, setReport] = useState<LarpReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const scan = async (target: string) => {
    if (!target.trim()) return;
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const res = await fetch(`/api/larpcheck?github=${encodeURIComponent(target.trim())}`);
      const json = (await res.json()) as LarpReport & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setReport(json);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const g = params.get("github");
    if (g) void scan(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="mx-auto max-w-3xl overflow-y-auto p-8">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-cyan to-acc text-sm font-black text-bg">L</span>
        <h1 className="text-2xl font-extrabold">LarpCheck</h1>
      </div>
      <p className="mt-2 text-sm text-mut">
        Le dev sait-il vraiment coder ? Colle un repo, un utilisateur ou une organisation GitHub. Six vérifications, un score sur 10, un verdict.
        Données : API publique GitHub. Rien n&apos;est stocké.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void scan(input);
        }}
      >
        <input className="input" placeholder="github.com/owner/repo" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn-primary whitespace-nowrap" disabled={busy}>
          {busy ? "Scan…" : "SCAN"}
        </button>
      </form>
      <div className="mt-2 flex gap-1.5">
        {EXAMPLES.map((x) => (
          <button key={x} className="pill" onClick={() => { setInput(x); void scan(x); }}>
            {x}
          </button>
        ))}
      </div>

      {err && <div className="mt-4 rounded-lg border border-dn/30 bg-dn/10 p-3 text-sm text-dn">{err}</div>}
      {report && (
        <div className="mt-6">
          <LarpReportView report={report} />
        </div>
      )}

      <h2 className="mt-10 text-base font-bold">Les six vérifications</h2>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {[
          ["Code authentique", "Vrais diffs ? Fork renommé ? Dump de code en 2 commits ?"],
          ["Timing des commits", "Cadence mécanique (script), rafales juste avant le launch."],
          ["Identité dev", "Âge du compte, repos publics, followers, contributeurs actifs."],
          ["Activité régulière", "Ship sur des mois ou silence radio après le launch ?"],
          ["Claims vs preuves", "« AI-powered », « on-chain » : les dépendances suivent-elles ?"],
          ["Contrat aligné", "Programme revendiqué = code de programme présent ? Le repo cite-t-il le token ?"],
        ].map(([t, d]) => (
          <div key={t} className="rounded-lg border border-line bg-panel p-3">
            <b className="text-sm">{t}</b>
            <p className="mt-1 text-xs text-mut">{d}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-base font-bold">Tiers</h2>
      <div className="mt-3 space-y-1.5">
        {TIER_ORDER.map((t) => (
          <div key={t} className="flex items-center gap-3 rounded-md border border-line bg-panel px-3 py-2 text-sm">
            <span className="grid h-6 w-6 place-items-center rounded font-black text-bg" style={{ background: TIER_COLOR[t] }}>
              {t}
            </span>
            <b>{TIER_LABELS[t]}</b>
            <span className="ml-auto text-xs text-dim">
              {t === "S" ? "9.0 – 10" : t === "A" ? "7.0 – 8.9" : t === "B" ? "5.0 – 6.9" : t === "C" ? "3.0 – 4.9" : t === "D" ? "1.5 – 2.9" : "0 – 1.4"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-dim">Not financial advice. Just facts.</p>
    </div>
  );
}
