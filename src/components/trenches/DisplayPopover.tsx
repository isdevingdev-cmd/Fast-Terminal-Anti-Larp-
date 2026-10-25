"use client";
import { useEffect, useRef, useState } from "react";
import { useFilters } from "@/lib/store/filters";

function Bool({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1 text-mut">
      <span>{label}</span>
      <button type="button" onClick={() => onChange(!value)} className={`relative h-[14px] w-[26px] rounded-full transition ${value ? "bg-acc" : "bg-line2"}`} aria-pressed={value}>
        <i className={`absolute top-[2px] h-[10px] w-[10px] rounded-full transition-all ${value ? "left-[14px] bg-white" : "left-[2px] bg-dim"}`} />
      </button>
    </label>
  );
}

export function DisplayPopover() {
  const display = useFilters((s) => s.display);
  const setDisplay = useFilters((s) => s.setDisplay);
  const exportJson = useFilters((s) => s.exportJson);
  const importJson = useFilters((s) => s.importJson);
  const [open, setOpen] = useState(false);
  const [io, setIo] = useState<"none" | "export" | "import">("none");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost !py-0.5">
        ⚙ Affichage
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[300px] rounded-lg border border-line2 bg-panel p-3 text-[11.5px] shadow-2xl">
          <b className="text-xs">Affichage des trenches</b>
          <p className="mb-1 text-[10px] text-dim">Les changements s&apos;appliquent immédiatement.</p>
          <label className="flex items-center justify-between py-1 text-mut">
            Densité
            <span className="seg">
              <button data-on={display.density === "compact"} onClick={() => setDisplay({ density: "compact" })}>
                Compact
              </button>
              <button data-on={display.density === "comfortable"} onClick={() => setDisplay({ density: "comfortable" })}>
                Confort
              </button>
            </span>
          </label>
          <label className="flex items-center justify-between py-1 text-mut">
            Lignes par colonne
            <select className="rounded border border-line2 bg-bg px-1 py-0.5 text-txt" value={display.rowsPerColumn} onChange={(e) => setDisplay({ rowsPerColumn: Number(e.target.value) })}>
              {[20, 40, 60, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Bool label="Valeurs en USD" value={display.showUsd} onChange={(v) => setDisplay({ showUsd: v })} />
          <Bool label="Images des tokens" value={display.showImages} onChange={(v) => setDisplay({ showImages: v })} />
          <Bool label="Flash sur les trades" value={display.flashOnTrade} onChange={(v) => setDisplay({ flashOnTrade: v })} />
          <Bool label="Bouton ⚡ sur les lignes" value={display.quickBuyOnRows} onChange={(v) => setDisplay({ quickBuyOnRows: v })} />

          <div className="mt-3 flex gap-1.5">
            <button
              className="btn-ghost flex-1 !py-1"
              onClick={() => {
                setText(exportJson());
                setIo("export");
                setMsg(null);
              }}
            >
              Exporter
            </button>
            <button
              className="btn-ghost flex-1 !py-1"
              onClick={() => {
                setText("");
                setIo("import");
                setMsg(null);
              }}
            >
              Importer
            </button>
          </div>
          {io !== "none" && (
            <div className="mt-2">
              <textarea className="input h-28 font-mono !text-[10px]" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"v":1,"filters":{...},"display":{...}}' />
              <div className="mt-1.5 flex gap-1.5">
                {io === "export" ? (
                  <button
                    className="btn-primary flex-1 !py-1"
                    onClick={() => {
                      void navigator.clipboard.writeText(text);
                      setMsg("Copié dans le presse-papiers");
                    }}
                  >
                    Copier
                  </button>
                ) : (
                  <button
                    className="btn-primary flex-1 !py-1"
                    onClick={() => {
                      const r = importJson(text);
                      setMsg(r.ok ? "Filtres importés" : `Erreur : ${r.error}`);
                    }}
                  >
                    Appliquer
                  </button>
                )}
                <button className="btn-ghost !py-1" onClick={() => setIo("none")}>
                  Fermer
                </button>
              </div>
              {msg && <p className="mt-1 text-[10.5px] text-acc2">{msg}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
