"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { APP_NAME, COMPETITOR_FEES, PLATFORM_FEE_BPS, SPEED_PRESETS, TOKEN_TICKER, type SpeedPreset } from "@/lib/config";
import { useSettings } from "@/lib/store/settings";
import { isValidPublicKey } from "@/lib/base58";
import { WalletMenu } from "@/components/wallet/WalletMenu";

const LINKS = [
  { href: "/", label: "Trenches" },
  { href: "/positions", label: "Positions" },
  { href: "/larpcheck", label: "LarpCheck", badge: "NEW" },
  { href: "/fee-audit", label: "Fee audit" },
];

export function TopNav() {
  const path = usePathname();
  const router = useRouter();
  const speed = useSettings((s) => s.speed);
  const setSettings = useSettings((s) => s.set);
  const [q, setQ] = useState("");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    if (isValidPublicKey(v)) router.push(`/token/${v}`);
    else if (/github\.com\//i.test(v) || /^[\w.-]+\/[\w.-]+$/.test(v)) router.push(`/larpcheck?github=${encodeURIComponent(v)}`);
    setQ("");
  };

  return (
    <header className="flex items-center gap-3 border-b border-line bg-panel px-4">
      <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-wide">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-acc to-[#c084fc] text-white">⚡</span>
        {APP_NAME}
        <span className="rounded bg-acc/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-acc2">ANTI-LARP</span>
      </Link>

      <nav className="ml-2 flex gap-1">
        {LINKS.map((l) => {
          const on = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition ${
                on ? "bg-panel2 text-txt shadow-[inset_0_0_0_1px_var(--color-line2)]" : "text-mut hover:text-txt"
              }`}
            >
              {l.label}
              {l.badge && <span className="ml-1 align-[2px] text-[8px] font-bold text-cyan">{l.badge}</span>}
            </Link>
          );
        })}
        <span className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-dim">{TOKEN_TICKER}</span>
      </nav>

      <form onSubmit={onSearch} className="ml-auto flex w-full max-w-[420px] items-center gap-2 rounded-md border border-line2 bg-bg px-2.5 py-1.5 text-dim">
        <span>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un CA ou un repo GitHub…"
          className="w-full bg-transparent text-xs text-txt outline-none placeholder:text-dim"
        />
        <kbd className="rounded border border-line2 px-1 text-[10px]">⏎</kbd>
      </form>

      <div className="seg">
        {(Object.keys(SPEED_PRESETS) as SpeedPreset[]).map((k) => (
          <button key={k} data-on={speed === k} onClick={() => setSettings({ speed: k })} title={`prio ${SPEED_PRESETS[k].priorityFeeSol} SOL`}>
            {SPEED_PRESETS[k].label}
          </button>
        ))}
      </div>

      <Link href="/fee-audit" className="pill border-up/35 bg-up/10 text-up" title="Frais plateforme par trade — tu ne paies que le réseau et pump.fun">
        {PLATFORM_FEE_BPS === 0 ? "0% fee" : `${(PLATFORM_FEE_BPS / 100).toFixed(2).replace(/\.?0+$/, "")}% fee`}
        <span className="font-medium text-dim">
          · {COMPETITOR_FEES.slice(0, 2).map((c) => `${c.name} ${c.bps / 100}%`).join(" · ")}
        </span>
      </Link>

      <WalletMenu />
    </header>
  );
}
