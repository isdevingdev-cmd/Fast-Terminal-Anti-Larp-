"use client";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/wallet/store";
import { shortAddr } from "@/lib/format";

type Mode = "menu" | "create" | "import" | "unlock" | "export";

export function WalletMenu() {
  const { wallets, activeId, unlocked, balances, hydrated } = useWallet();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const active = wallets.find((w) => w.id === activeId) ?? null;
  const bal = active ? balances.get(active.id) : undefined;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          setMode(wallets.length === 0 ? "create" : !unlocked ? "unlock" : "menu");
        }}
        className="flex items-center gap-2 rounded-md border border-line2 bg-panel2 py-1 pl-1 pr-2 text-left"
      >
        <span className="h-[22px] w-[22px] rounded-md bg-gradient-to-br from-[#f472b6] to-acc" />
        {!hydrated ? (
          <span className="text-xs text-mut">…</span>
        ) : active ? (
          <span>
            <b className="block text-xs">{bal !== undefined ? `${bal.toFixed(3)} SOL` : "— SOL"}</b>
            <small className="block font-mono text-[10px] text-mut">
              {shortAddr(active.publicKey)} {unlocked ? "" : "🔒"}
            </small>
          </span>
        ) : (
          <span className="text-xs font-semibold">Créer un wallet</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[340px] rounded-lg border border-line2 bg-panel p-3 shadow-2xl">
          {mode === "menu" && <Menu onMode={setMode} onClose={() => setOpen(false)} />}
          {mode === "create" && <CreateForm onDone={() => setMode("menu")} />}
          {mode === "import" && <ImportForm onDone={() => setMode("menu")} />}
          {mode === "unlock" && <UnlockForm onDone={() => setMode("menu")} />}
          {mode === "export" && <ExportView onDone={() => setMode("menu")} />}
        </div>
      )}
    </div>
  );
}

function Menu({ onMode, onClose }: { onMode: (m: Mode) => void; onClose: () => void }) {
  const { wallets, activeId, balances, unlocked, setActive, lock, removeWallet, refreshBalances } = useWallet();
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div>
      <div className="section-title">
        Wallets <span className="normal-case tracking-normal text-acc2">non-custodial · chiffrés localement</span>
      </div>
      <div className="space-y-1">
        {wallets.map((w) => (
          <div
            key={w.id}
            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${w.id === activeId ? "border-acc/40 bg-acc/10" : "border-line bg-bg"}`}
          >
            <button className="flex-1 text-left" onClick={() => setActive(w.id)}>
              <b className="block text-xs">{w.label}</b>
              <span className="font-mono text-[10px] text-mut">{shortAddr(w.publicKey, 6)}</span>
            </button>
            <span className="text-xs font-semibold">{(balances.get(w.id) ?? 0).toFixed(3)} SOL</span>
            <button
              className="btn-ghost !px-1.5 !py-0.5"
              title="Copier l'adresse (pour déposer)"
              onClick={() => {
                void navigator.clipboard.writeText(w.publicKey);
                setCopied(w.id);
                setTimeout(() => setCopied(null), 1200);
              }}
            >
              {copied === w.id ? "✓" : "⧉"}
            </button>
            <button
              className="btn-ghost !px-1.5 !py-0.5 text-dn"
              title="Retirer de ce navigateur (exporte la clé avant !)"
              onClick={() => {
                if (confirm(`Retirer ${w.label} de ce navigateur ? Assure-toi d'avoir exporté la clé privée.`)) removeWallet(w.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        {wallets.length === 0 && <p className="text-xs text-mut">Aucun wallet. Crée-en un ou importe une clé.</p>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button className="btn-primary" onClick={() => onMode("create")}>
          + Nouveau wallet
        </button>
        <button className="btn-ghost" onClick={() => onMode("import")}>
          Importer une clé
        </button>
        <button className="btn-ghost" disabled={!unlocked} onClick={() => onMode("export")}>
          Exporter la clé
        </button>
        {unlocked ? (
          <button
            className="btn-ghost"
            onClick={() => {
              lock();
              onClose();
            }}
          >
            🔒 Verrouiller
          </button>
        ) : (
          <button className="btn-ghost" onClick={() => onMode("unlock")}>
            Déverrouiller
          </button>
        )}
        <button className="btn-ghost col-span-2" onClick={() => void refreshBalances()}>
          ↻ Rafraîchir les soldes
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-dim">
        Les clés sont générées dans ton navigateur et chiffrées (AES-256-GCM) avec ton mot de passe. Rien n&apos;est envoyé à un serveur. Exporte et
        sauvegarde ta clé : si tu vides le stockage du navigateur, elle est perdue.
      </p>
    </div>
  );
}

function PasswordFields({ pwd, setPwd, confirm, setConfirm, needConfirm }: { pwd: string; setPwd: (v: string) => void; confirm?: string; setConfirm?: (v: string) => void; needConfirm?: boolean }) {
  return (
    <>
      <input className="input" type="password" placeholder="Mot de passe (chiffre la clé localement)" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus />
      {needConfirm && setConfirm && (
        <input className="input" type="password" placeholder="Confirmer le mot de passe" value={confirm ?? ""} onChange={(e) => setConfirm(e.target.value)} />
      )}
    </>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const { createWallet, wallets, unlocked, unlock } = useWallet();
  const [label, setLabel] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstWallet = wallets.length === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pwd.length < 8) return setErr("8 caractères minimum");
    if (firstWallet && pwd !== confirm) return setErr("Les mots de passe diffèrent");
    setBusy(true);
    try {
      if (!firstWallet && !unlocked) await unlock(pwd); // same password protects every wallet of the vault
      await createWallet(label, pwd);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="section-title">Nouveau wallet</div>
      <input className="input" placeholder="Nom (ex: Main, Sniper)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <PasswordFields pwd={pwd} setPwd={setPwd} confirm={confirm} setConfirm={setConfirm} needConfirm={firstWallet} />
      {err && <p className="text-xs text-dn">{err}</p>}
      <div className="flex gap-1.5">
        <button className="btn-primary flex-1" disabled={busy}>
          {busy ? "Génération…" : "Créer"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const { importWallet, wallets, unlocked, unlock } = useWallet();
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pwd.length < 8) return setErr("8 caractères minimum");
    setBusy(true);
    try {
      if (wallets.length && !unlocked) await unlock(pwd);
      await importWallet(label, secret, pwd);
      setSecret("");
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="section-title">Importer une clé privée</div>
      <input className="input" placeholder="Nom" value={label} onChange={(e) => setLabel(e.target.value)} />
      <textarea className="input h-16 font-mono text-xs" placeholder="Clé privée base58 (export Phantom / Solflare)" value={secret} onChange={(e) => setSecret(e.target.value)} />
      <PasswordFields pwd={pwd} setPwd={setPwd} />
      {err && <p className="text-xs text-dn">{err}</p>}
      <div className="flex gap-1.5">
        <button className="btn-primary flex-1" disabled={busy}>
          Importer
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function UnlockForm({ onDone }: { onDone: () => void }) {
  const unlock = useWallet((s) => s.unlock);
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await unlock(pwd);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="section-title">Déverrouiller</div>
      <PasswordFields pwd={pwd} setPwd={setPwd} />
      {err && <p className="text-xs text-dn">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "…" : "Déverrouiller"}
      </button>
    </form>
  );
}

function ExportView({ onDone }: { onDone: () => void }) {
  const { activeId, exportSecret, wallets } = useWallet();
  const [shown, setShown] = useState(false);
  const w = wallets.find((x) => x.id === activeId);
  const secret = activeId ? exportSecret(activeId) : null;
  return (
    <div className="space-y-2">
      <div className="section-title">Exporter — {w?.label}</div>
      <p className="text-xs text-warn">Ne partage jamais cette clé. Quiconque la possède contrôle le wallet.</p>
      {shown ? (
        <textarea readOnly className="input h-20 font-mono text-[11px]" value={secret ?? ""} onFocus={(e) => e.currentTarget.select()} />
      ) : (
        <button className="btn-ghost w-full" onClick={() => setShown(true)}>
          Afficher la clé privée
        </button>
      )}
      <button className="btn-ghost w-full" onClick={onDone}>
        Fermer
      </button>
    </div>
  );
}
