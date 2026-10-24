"use client";
import { useEffect } from "react";
import { useTokenStore } from "../store/tokens";
import { extractGithub } from "../pump/metadata";
import { requestMetadata } from "../feed/metadataLoader";
import type { TrackedToken } from "../pump/types";
import type { LarpReport } from "./types";

export type LarpEntry = LarpReport | { status: "loading" | "none" };

const inflight = new Set<string>();

export function isReport(e: LarpEntry | undefined): e is LarpReport {
  return !!e && "score" in e;
}

/** Scan a GitHub target for a token and store the result. Idempotent. */
export async function scanTokenGithub(mint: string, github: string, token?: TrackedToken): Promise<void> {
  if (inflight.has(mint)) return;
  inflight.add(mint);
  const store = useTokenStore.getState();
  store.setLarp(mint, { status: "loading" });
  try {
    const qs = new URLSearchParams({ github, mint });
    if (token?.name) qs.set("name", token.name);
    if (token?.symbol) qs.set("symbol", token.symbol);
    const res = await fetch(`/api/larpcheck?${qs}`);
    const json = (await res.json()) as LarpReport & { error?: string };
    if (!res.ok) {
      store.setLarp(mint, { ...emptyReport(github), error: json.error ?? `HTTP ${res.status}` });
    } else store.setLarp(mint, json);
  } catch (e) {
    store.setLarp(mint, { ...emptyReport(github), error: (e as Error).message });
  } finally {
    inflight.delete(mint);
  }
}

function emptyReport(input: string): LarpReport {
  return {
    input,
    repo: null,
    owner: null,
    score: 0,
    tier: "F",
    verdict: "",
    summary: "",
    checks: [],
    weeklyCommits: [],
    contributors: [],
    scannedAt: Date.now(),
  };
}

/**
 * Ensures metadata is loaded and, when a GitHub link exists, a LarpCheck scan is triggered.
 * Returns the current entry (undefined while metadata is unknown).
 */
export function useLarp(token: TrackedToken | undefined): LarpEntry | undefined {
  const entry = useTokenStore((s) => (token ? s.larp.get(token.mint) : undefined));
  const mint = token?.mint;
  const mdStatus = token?.metadataStatus;
  const github = extractGithub(token?.metadata);

  useEffect(() => {
    if (!mint || !token) return;
    if (mdStatus === "idle") requestMetadata(mint);
    if (mdStatus === "done" || mdStatus === "error") {
      const cur = useTokenStore.getState().larp.get(mint);
      if (cur) return;
      if (github) void scanTokenGithub(mint, github, token);
      else useTokenStore.getState().setLarp(mint, { status: "none" });
    }
  }, [mint, mdStatus, github, token]);

  return entry;
}
