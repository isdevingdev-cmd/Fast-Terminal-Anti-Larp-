"use client";
import { useEffect } from "react";
import { Buffer } from "buffer";
import { startPumpFeed } from "@/lib/feed/pumpFeed";
import { startMarketPolling } from "@/lib/store/market";
import { startBalancePolling, useWallet } from "@/lib/wallet/store";

/** Boots the live feed, price polling and wallet vault once on the client. */
export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useWallet((s) => s.hydrate);
  useEffect(() => {
    // @solana/web3.js expects a global Buffer in the browser.
    if (typeof window !== "undefined" && !(window as unknown as { Buffer?: unknown }).Buffer) {
      (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
    }
    hydrate();
    startPumpFeed();
    startMarketPolling();
    startBalancePolling();
  }, [hydrate]);
  return <>{children}</>;
}
