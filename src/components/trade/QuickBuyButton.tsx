"use client";
import { useState } from "react";
import type { TrackedToken } from "@/lib/pump/types";
import { useSettings } from "@/lib/store/settings";
import { useQuickTrade } from "@/lib/trade/useQuickTrade";

/** One-click buy with the preset amount; stops navigation when placed inside a row link. */
export function QuickBuyButton({ token }: { token: TrackedToken }) {
  const amount = useSettings((s) => s.quickBuyAmount);
  const { buy, ready } = useQuickTrade();
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ready || state === "busy") return;
    setState("busy");
    try {
      await buy(token, amount);
      setState("ok");
    } catch {
      setState("err");
    } finally {
      setTimeout(() => setState("idle"), 1500);
    }
  };

  const cls =
    state === "ok" ? "bg-up text-bg" : state === "err" ? "bg-dn/20 text-dn border-dn/40" : "bg-up/15 text-up border-up/30 hover:bg-up/25";
  return (
    <button
      onClick={onClick}
      disabled={!ready}
      title={ready ? `Acheter ${amount} SOL` : "Déverrouille un wallet pour trader"}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {state === "busy" ? "…" : state === "ok" ? "✓" : state === "err" ? "✕" : `⚡ ${amount}`}
    </button>
  );
}
