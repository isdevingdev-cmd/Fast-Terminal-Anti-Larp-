import type { TrackedToken } from "../pump/types";
import type { ColumnFilters } from "./types";
import type { LarpEntry } from "../larpcheck/client";
import { isReport } from "../larpcheck/client";
import { tierAtLeast } from "../larpcheck/types";
import { extractGithub } from "../pump/metadata";

export interface FilterContext {
  now: number;
  solUsd: number;
  larp?: LarpEntry;
}

function keywords(s: string): string[] {
  return s
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

/** Pure predicate: does `t` pass the column filters? */
export function passesFilters(t: TrackedToken, f: ColumnFilters, ctx: FilterContext): boolean {
  const usd = ctx.solUsd > 0 ? ctx.solUsd : 0;
  const mcUsd = t.marketCapSol * usd;
  if (usd > 0) {
    if (f.mcMinUsd !== undefined && mcUsd < f.mcMinUsd) return false;
    if (f.mcMaxUsd !== undefined && mcUsd > f.mcMaxUsd) return false;
    if (f.volMinUsd !== undefined && t.volumeSol * usd < f.volMinUsd) return false;
  }
  const ageMin = (ctx.now - t.createdAt) / 60_000;
  if (t.createdKnown) {
    if (f.ageMinMin !== undefined && ageMin < f.ageMinMin) return false;
    if (f.ageMaxMin !== undefined && ageMin > f.ageMaxMin) return false;
  } else if (f.hideUnknownAge || f.ageMaxMin !== undefined) {
    // an upper age bound implies we must know the age
    return false;
  }
  if (f.tradersMin !== undefined && t.traders.size < f.tradersMin) return false;
  if (f.txMin !== undefined && t.tradeCount < f.txMin) return false;
  const devPct = Number(t.creatorTokenUnits) / 1e13;
  if (f.devMaxPct !== undefined && devPct > f.devMaxPct) return false;
  if (f.bundleMaxPct !== undefined && t.bundleShare * 100 > f.bundleMaxPct) return false;
  const bond = t.stage === "migrated" ? 100 : t.bondingProgress * 100;
  if (f.bondMin !== undefined && bond < f.bondMin) return false;
  if (f.bondMax !== undefined && bond > f.bondMax) return false;

  const md = t.metadata;
  if (f.requireTwitter && !md?.twitter) return false;
  if (f.requireTelegram && !md?.telegram) return false;
  if (f.requireWebsite && !md?.website) return false;
  if (f.requireAnySocial && !(md?.twitter || md?.telegram || md?.website)) return false;
  if (f.requireImage && !md?.image) return false;
  if (f.requireGithub && !extractGithub(md)) return false;
  if (f.hideDevSold && t.devSold) return false;
  if (f.hideMayhem && t.mayhem) return false;
  if (f.onlyMayhem && !t.mayhem) return false;

  const hay = `${t.name} ${t.symbol}`.toLowerCase();
  const inc = keywords(f.keywordsInclude);
  if (inc.length && !inc.some((k) => hay.includes(k))) return false;
  const exc = keywords(f.keywordsExclude);
  if (exc.length && exc.some((k) => hay.includes(k))) return false;

  if (isReport(ctx.larp) && !ctx.larp.error) {
    if (f.hideFullLarp && ctx.larp.tier === "F") return false;
    if (f.larpMinTier && !tierAtLeast(ctx.larp.tier, f.larpMinTier)) return false;
  }
  return true;
}

/** Count of constraints set, for the "Filtres (3)" badge. */
export function activeFilterCount(f: ColumnFilters): number {
  let n = 0;
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith("keywords")) {
      if (typeof v === "string" && v.trim()) n++;
    } else if (typeof v === "boolean") {
      if (v) n++;
    } else if (v !== undefined && v !== null) n++;
  }
  return n;
}
