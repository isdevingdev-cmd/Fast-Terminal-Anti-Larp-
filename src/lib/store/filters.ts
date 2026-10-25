"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_COLUMN_FILTERS,
  DEFAULT_DISPLAY,
  DEFAULT_FILTERS,
  type ColumnFilters,
  type ColumnId,
  type DisplaySettings,
  type FiltersExport,
} from "../filters/types";

interface FiltersState {
  filters: Record<ColumnId, ColumnFilters>;
  display: DisplaySettings;
  setFilter: (col: ColumnId, patch: Partial<ColumnFilters>) => void;
  resetFilters: (col: ColumnId) => void;
  copyFilters: (from: ColumnId, to: ColumnId[]) => void;
  setDisplay: (patch: Partial<DisplaySettings>) => void;
  exportJson: () => string;
  importJson: (json: string) => { ok: boolean; error?: string };
}

export const useFilters = create<FiltersState>()(
  persist(
    (set, get) => ({
      filters: DEFAULT_FILTERS,
      display: DEFAULT_DISPLAY,
      setFilter: (col, patch) => set((s) => ({ filters: { ...s.filters, [col]: { ...s.filters[col], ...patch } } })),
      resetFilters: (col) => set((s) => ({ filters: { ...s.filters, [col]: { ...DEFAULT_FILTERS[col] } } })),
      copyFilters: (from, to) =>
        set((s) => {
          const next = { ...s.filters };
          for (const c of to) next[c] = { ...s.filters[from] };
          return { filters: next };
        }),
      setDisplay: (patch) => set((s) => ({ display: { ...s.display, ...patch } })),
      exportJson: () => JSON.stringify({ v: 1, filters: get().filters, display: get().display } satisfies FiltersExport, null, 2),
      importJson: (json) => {
        try {
          const parsed = JSON.parse(json) as Partial<FiltersExport>;
          if (!parsed || typeof parsed !== "object" || !parsed.filters) return { ok: false, error: "format inattendu" };
          const cols: ColumnId[] = ["new", "bonding", "migrated"];
          const filters = { ...DEFAULT_FILTERS };
          for (const c of cols) filters[c] = { ...DEFAULT_COLUMN_FILTERS, ...(parsed.filters[c] ?? {}) };
          set({ filters, display: { ...DEFAULT_DISPLAY, ...(parsed.display ?? {}) } });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),
    { name: "fast-terminal.filters.v1" },
  ),
);
