import type { LarpTier } from "../larpcheck/types";

export type ColumnId = "new" | "bonding" | "migrated";

/** Per-column filters, Motion-style. All optional; undefined = no constraint. Money values in USD. */
export interface ColumnFilters {
  mcMinUsd?: number;
  mcMaxUsd?: number;
  /** minutes since on-chain creation */
  ageMinMin?: number;
  ageMaxMin?: number;
  tradersMin?: number;
  txMin?: number;
  volMinUsd?: number;
  /** % of supply */
  devMaxPct?: number;
  bundleMaxPct?: number;
  /** bonding progress % */
  bondMin?: number;
  bondMax?: number;
  requireTwitter: boolean;
  requireTelegram: boolean;
  requireWebsite: boolean;
  requireAnySocial: boolean;
  requireGithub: boolean;
  requireImage: boolean;
  hideDevSold: boolean;
  hideMayhem: boolean;
  onlyMayhem: boolean;
  /** hide tokens whose creation time is unknown (seen only through trades) */
  hideUnknownAge: boolean;
  /** comma-separated, case-insensitive, matched on name + symbol */
  keywordsInclude: string;
  keywordsExclude: string;
  /** LarpCheck (applies only to tokens already scanned) */
  larpMinTier: LarpTier | null;
  hideFullLarp: boolean;
}

export interface DisplaySettings {
  density: "compact" | "comfortable";
  showUsd: boolean;
  showImages: boolean;
  flashOnTrade: boolean;
  /** rows per column */
  rowsPerColumn: number;
  /** quick buy button on rows */
  quickBuyOnRows: boolean;
}

export const DEFAULT_COLUMN_FILTERS: ColumnFilters = {
  requireTwitter: false,
  requireTelegram: false,
  requireWebsite: false,
  requireAnySocial: false,
  requireGithub: false,
  requireImage: false,
  hideDevSold: false,
  hideMayhem: false,
  onlyMayhem: false,
  hideUnknownAge: false,
  keywordsInclude: "",
  keywordsExclude: "",
  larpMinTier: null,
  hideFullLarp: false,
};

export const DEFAULT_FILTERS: Record<ColumnId, ColumnFilters> = {
  new: { ...DEFAULT_COLUMN_FILTERS, ageMaxMin: 30 },
  bonding: { ...DEFAULT_COLUMN_FILTERS, bondMin: 30 },
  migrated: { ...DEFAULT_COLUMN_FILTERS },
};

export const DEFAULT_DISPLAY: DisplaySettings = {
  density: "comfortable",
  showUsd: true,
  showImages: true,
  flashOnTrade: true,
  rowsPerColumn: 40,
  quickBuyOnRows: true,
};

export interface FiltersExport {
  v: 1;
  filters: Record<ColumnId, ColumnFilters>;
  display: DisplaySettings;
}
