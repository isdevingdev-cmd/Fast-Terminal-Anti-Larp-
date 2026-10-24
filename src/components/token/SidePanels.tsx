"use client";
import type { TrackedToken } from "@/lib/pump/types";
import { fmtCompact, fmtSol, shortAddr, timeAgo } from "@/lib/format";
import { solToMigration } from "@/lib/pump/curve";
import { useMarket } from "@/lib/store/market";

function Check({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  const cls = ok ? "bg-up" : warn ? "bg-warn" : "bg-dn";
  const ch = ok ? "✓" : warn ? "!" : "×";
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line bg-bg px-2 py-1.5 text-[11px] font-medium">
      <i className={`grid h-3 w-3 flex-none place-items-center rounded-full text-[8px] font-black not-italic text-bg ${cls}`}>{ch}</i>
      {label}
    </div>
  );
}

export function SecurityPanel({ token }: { token: TrackedToken }) {
  const devPct = Number(token.creatorTokenUnits) / 1e13;
  const bundlePct = token.bundleShare * 100;
  const sells = token.sellCount;
  const holders = token.traders.size;
  return (
    <div className="border-b border-line p-3">
      <div className="section-title">
        Sécurité <span className="normal-case tracking-normal text-mut">on-chain · depuis connexion</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Check ok label="Mint révoqué (pump.fun)" />
        <Check ok label="Freeze révoqué (pump.fun)" />
        <Check ok={!token.devSold} label={token.devSold ? "Dev a vendu" : "Dev n'a pas vendu"} />
        <Check ok={devPct <= 5} warn={devPct > 5 && devPct <= 10} label={`Dev ${devPct.toFixed(1)} %`} />
        <Check ok={bundlePct <= 15} warn={bundlePct > 15 && bundlePct <= 30} label={`Bundle ${bundlePct.toFixed(0)} %`} />
        <Check ok={holders >= 50} warn={holders >= 15 && holders < 50} label={`${holders} traders uniques`} />
        <Check ok={sells / Math.max(1, token.tradeCount) < 0.5} warn label={`${token.buyCount}B / ${sells}S`} />
        <Check ok={token.stage !== "migrated" || true} label={token.stage === "migrated" ? "Migré (PumpSwap)" : "Sur la courbe"} />
      </div>
      <p className="mt-2 text-[10px] leading-snug text-dim">
        Mint/freeze : pump.fun révoque les autorités à la création. Les autres métriques sont dérivées des événements reçus et peuvent sous-estimer
        l&apos;historique d&apos;un token créé avant ta connexion.
      </p>
    </div>
  );
}

export function BondingPanel({ token }: { token: TrackedToken }) {
  const pct = Math.round(token.bondingProgress * 100);
  const left = solToMigration(token.virtualSolReserves, token.virtualTokenReserves);
  return (
    <div className="border-b border-line p-3">
      <div className="section-title">
        Bonding curve <span className="normal-case tracking-normal text-acc2">pump.fun</span>
      </div>
      <div className="kv">
        <span>Progression</span>
        <b>{token.stage === "migrated" ? "100 % · migré" : `${pct} %`}</b>
      </div>
      <div className="my-1.5 h-2 overflow-hidden rounded bg-line2">
        <i className="block h-full rounded bg-gradient-to-r from-acc to-cyan" style={{ width: `${token.stage === "migrated" ? 100 : pct}%` }} />
      </div>
      <div className="kv">
        <span>SOL restants avant migration</span>
        <b>{token.stage === "migrated" ? "—" : `${fmtSol(left, 1)} SOL`}</b>
      </div>
      <div className="kv">
        <span>SOL virtuels</span>
        <b>{fmtSol(Number(token.virtualSolReserves) / 1e9, 1)}</b>
      </div>
    </div>
  );
}

export function DevPanel({ token }: { token: TrackedToken }) {
  const solUsd = useMarket((s) => s.solUsd);
  return (
    <div className="border-b border-line p-3">
      <div className="section-title">Développeur</div>
      {token.creator ? (
        <>
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-bg p-2">
            <span className="h-[30px] w-[30px] rounded-md bg-gradient-to-br from-[#a3e635] to-cyan" />
            <div>
              <a href={`https://solscan.io/account/${token.creator}`} target="_blank" rel="noreferrer" className="block font-mono text-xs hover:text-acc2">
                {shortAddr(token.creator, 6)} ↗
              </a>
              <small className="text-[10.5px] text-dim">créateur du token · {timeAgo(token.createdAt)}</small>
            </div>
          </div>
          <div className="kv">
            <span>Holding dev</span>
            <b>
              {(Number(token.creatorTokenUnits) / 1e13).toFixed(2)} % · {fmtCompact(Number(token.creatorTokenUnits) / 1e6)} tokens
            </b>
          </div>
          <div className="kv">
            <span>Flux net dev</span>
            <b className={token.devNetSol >= 0 ? "text-up" : "text-dn"}>
              {fmtSol(token.devNetSol, 2)} SOL {solUsd ? `(≈ $${(token.devNetSol * solUsd).toFixed(0)})` : ""}
            </b>
          </div>
          <div className="kv">
            <span>Ventes dev</span>
            <b className={token.devSold ? "text-dn" : "text-up"}>{token.devSold ? "oui" : "aucune vue"}</b>
          </div>
        </>
      ) : (
        <p className="text-xs text-dim">Créateur inconnu (événement de création non reçu). L&apos;historique est en cours de chargement.</p>
      )}
    </div>
  );
}

export function DistributionPanel({ token }: { token: TrackedToken }) {
  const dev = Math.min(100, Number(token.creatorTokenUnits) / 1e13);
  const bundle = Math.min(100 - dev, token.bundleShare * 100);
  const curve = Math.min(100 - dev - bundle, (Number(token.virtualTokenReserves - (1_073_000_000_000_000n - 793_100_000_000_000n)) / 1e15) * 100);
  const rest = Math.max(0, 100 - dev - bundle - curve);
  return (
    <div className="border-b border-line p-3">
      <div className="section-title">
        Distribution <span className="normal-case tracking-normal text-mut">{token.traders.size} traders</span>
      </div>
      <div className="my-1.5 flex h-3 gap-[2px] overflow-hidden rounded">
        <i style={{ width: `${curve}%` }} className="bg-line2" title="Encore sur la courbe" />
        <i style={{ width: `${dev}%` }} className="bg-acc" title="Dev" />
        <i style={{ width: `${bundle}%` }} className="bg-dn" title="Bundle" />
        <i style={{ width: `${rest}%` }} className="bg-up/60" title="Holders" />
      </div>
      {[
        ["Sur la courbe", curve, "bg-line2"],
        ["Dev", dev, "bg-acc"],
        ["Bundle (slot de création)", bundle, "bg-dn"],
        ["Autres holders", rest, "bg-up/60"],
      ].map(([label, v, cls]) => (
        <div key={label as string} className="kv !py-0.5">
          <span className="flex items-center gap-1.5">
            <i className={`inline-block h-2 w-2 rounded-sm ${cls}`} />
            {label}
          </span>
          <b>{(v as number).toFixed(1)} %</b>
        </div>
      ))}
    </div>
  );
}
