"use client";
import { useSettings } from "@/lib/store/settings";
import { useWallet } from "@/lib/wallet/store";
import { shortAddr } from "@/lib/format";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative h-[14px] w-[26px] rounded-full transition ${on ? "bg-acc" : "bg-line2"}`}
      aria-pressed={on}
    >
      <i className={`absolute top-[2px] h-[10px] w-[10px] rounded-full transition-all ${on ? "left-[14px] bg-white" : "left-[2px] bg-dim"}`} />
    </button>
  );
}

export function TrenchSidebar() {
  const s = useSettings();
  const { wallets, balances, activeId, setActive } = useWallet();

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-line bg-panel">
      <div className="border-b border-line p-3">
        <div className="section-title">
          Wallets <span className="normal-case tracking-normal text-acc2">{wallets.length}</span>
        </div>
        {wallets.length === 0 && <p className="text-xs text-dim">Crée un wallet en haut à droite.</p>}
        {wallets.map((w) => (
          <button key={w.id} onClick={() => setActive(w.id)} className="flex w-full items-center justify-between py-1.5 text-left">
            <span className="flex items-center gap-2">
              <i className={`h-2 w-2 rounded-full ${w.id === activeId ? "bg-acc" : "bg-line2"}`} />
              <span>
                <b className="block text-xs">{w.label}</b>
                <span className="font-mono text-[10px] text-dim">{shortAddr(w.publicKey)}</span>
              </span>
            </span>
            <span>
              <b>{(balances.get(w.id) ?? 0).toFixed(2)}</b> <span className="text-mut">SOL</span>
            </span>
          </button>
        ))}
      </div>

      <div className="border-b border-line p-3">
        <div className="section-title">
          Quick buy <span className="normal-case tracking-normal text-acc2">SOL</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {s.quickBuyPresets.map((v) => (
            <button
              key={v}
              onClick={() => s.set({ quickBuyAmount: v })}
              className={`rounded-md border py-1.5 text-center font-semibold ${v === s.quickBuyAmount ? "border-acc bg-acc/15 text-acc2" : "border-line2 bg-bg"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <label className="kv mt-2">
          Slippage
          <span className="flex items-center gap-1">
            <input
              type="number"
              className="w-14 rounded border border-line2 bg-bg px-1.5 py-0.5 text-right text-txt"
              value={s.slippagePct}
              min={1}
              max={99}
              onChange={(e) => s.set({ slippagePct: Number(e.target.value) })}
            />
            %
          </span>
        </label>
        <label className="kv">
          MEV protect (Jito) <Toggle on={s.mevProtect} onChange={(v) => s.set({ mevProtect: v })} />
        </label>
      </div>

      <div className="border-b border-line p-3">
        <div className="section-title">Filtres</div>
        <p className="text-[11px] leading-snug text-mut">
          Chaque colonne a son bouton <b className="text-txt">⚲ Filtres</b> (MC, âge, traders, dev, bundle, socials, mots-clés, LarpCheck). Les réglages d&apos;affichage et
          l&apos;import/export sont dans <b className="text-txt">⚙ Affichage</b>.
        </p>
      </div>

      <div className="p-3 text-[10px] leading-snug text-dim">
        Les métriques dev/bundle/holders sont calculées à partir des événements on-chain reçus depuis ta connexion. Les tokens créés avant ta
        connexion sont complétés au fil des trades.
      </div>
    </aside>
  );
}
