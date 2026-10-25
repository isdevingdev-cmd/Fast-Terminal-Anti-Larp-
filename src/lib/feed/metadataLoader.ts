"use client";
import { useTokenStore } from "../store/tokens";
import type { TokenMetadata } from "../pump/types";

const CONCURRENCY = 4;
const queue: string[] = [];
const inflight = new Set<string>();
const failed = new Map<string, number>();

interface TokenApiResponse {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  metadata: TokenMetadata | null;
  supply?: string | null;
  mayhem?: boolean;
}

async function work() {
  while (inflight.size < CONCURRENCY && queue.length) {
    const mint = queue.shift()!;
    const store = useTokenStore.getState();
    const t = store.tokens.get(mint);
    if (!t || t.metadataStatus !== "loading") continue;
    inflight.add(mint);
    (async () => {
      try {
        const qs = new URLSearchParams({ mint });
        if (t.uri) qs.set("uri", t.uri);
        const res = await fetch(`/api/token?${qs.toString()}`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as TokenApiResponse;
        const cur = useTokenStore.getState().tokens.get(mint);
        if (cur) {
          if (!cur.name && body.name) cur.name = body.name;
          if (!cur.symbol && body.symbol) cur.symbol = body.symbol;
          if (!cur.uri && body.uri) cur.uri = body.uri;
          if (body.mayhem !== undefined) cur.mayhem = body.mayhem;
        }
        useTokenStore.getState().setMetadata(mint, body.metadata);
      } catch {
        failed.set(mint, Date.now());
        useTokenStore.getState().setMetadata(mint, null);
      } finally {
        inflight.delete(mint);
        void work();
      }
    })();
  }
}

/** Ask for metadata of a token; safe to call repeatedly (idempotent). */
export function requestMetadata(mint: string) {
  const store = useTokenStore.getState();
  const t = store.tokens.get(mint);
  if (!t || t.metadataStatus !== "idle") return;
  const lastFail = failed.get(mint);
  if (lastFail && Date.now() - lastFail < 60_000) return;
  t.metadataStatus = "loading";
  queue.push(mint);
  void work();
}
