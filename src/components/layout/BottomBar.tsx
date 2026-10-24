"use client";
import { useTokenStore } from "@/lib/store/tokens";
import { useMarket } from "@/lib/store/market";
import { useFps } from "@/lib/hooks/useFps";

export function BottomBar() {
  const status = useTokenStore((s) => s.feedStatus);
  const slot = useTokenStore((s) => s.lastSlot);
  const eps = useTokenStore((s) => s.eventsPerSec);
  const tokens = useTokenStore((s) => s.tokens.size);
  const solUsd = useMarket((s) => s.solUsd);
  const fps = useFps();

  const dot =
    status === "live" ? "bg-up shadow-[0_0_8px_var(--color-up)]" : status === "connecting" ? "bg-warn" : status === "paused" ? "bg-dim" : "bg-dn";

  return (
    <footer className="flex items-center gap-4 border-t border-line bg-panel px-3.5 text-[11px] text-mut">
      <span className="font-semibold text-txt">Trenches</span>
      <span>{tokens} tokens suivis</span>
      <span>{eps} evt/s</span>
      <div className="ml-auto flex items-center gap-4">
        <span>
          SOL <b className="font-semibold text-txt">{solUsd ? `$${solUsd.toFixed(2)}` : "—"}</b>
        </span>
        <span>
          Slot <b className="font-semibold text-txt">{slot ? slot.toLocaleString("fr-FR") : "—"}</b>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className={`h-[7px] w-[7px] rounded-full ${dot}`} />
          {status === "live" ? "Connecté" : status === "connecting" ? "Connexion…" : status === "paused" ? "Pause" : "Déconnecté"}
        </span>
        <span>{fps} FPS</span>
      </div>
    </footer>
  );
}
