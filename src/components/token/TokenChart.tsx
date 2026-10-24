"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { TrackedToken } from "@/lib/pump/types";
import { buildCandles, TIMEFRAMES, type Timeframe } from "@/lib/chart/candles";
import { useMarket } from "@/lib/store/market";
import { useTokenStore } from "@/lib/store/tokens";
import { fmtCompact } from "@/lib/format";

const UP = "#22c55e";
const DN = "#ef4444";

export function TokenChart({ token }: { token: TrackedToken }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [tf, setTf] = useState<Timeframe>("5s");
  const [unit, setUnit] = useState<"usd" | "sol">("usd");
  const solUsd = useMarket((s) => s.solUsd);
  const version = useTokenStore((s) => s.version);
  const mult = unit === "usd" && solUsd ? solUsd : 1;

  // Create the chart once.
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8a93a6", fontFamily: "Inter, system-ui, sans-serif", fontSize: 11 },
      grid: { vertLines: { color: "#1b2130" }, horzLines: { color: "#1b2130" } },
      rightPriceScale: { borderColor: "#242c3d", scaleMargins: { top: 0.08, bottom: 0.25 } },
      timeScale: { borderColor: "#242c3d", timeVisible: true, secondsVisible: true, rightOffset: 4 },
      crosshair: { vertLine: { color: "#8b5cf6", labelBackgroundColor: "#8b5cf6" }, horzLine: { color: "#8b5cf6", labelBackgroundColor: "#8b5cf6" } },
      autoSize: true,
      localization: { priceFormatter: (p: number) => (unit === "usd" ? `$${fmtCompact(p, 2)}` : `${fmtCompact(p, 2)} SOL`) },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DN,
      priceFormat: { type: "custom", minMove: 0.0001, formatter: (p: number) => (unit === "usd" ? `$${fmtCompact(p, 2)}` : `${fmtCompact(p, 2)} SOL`) },
    });
    const vol = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, color: "rgba(34,197,94,.35)" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = vol;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
    // unit is applied through setData formatting below; recreate on unit change for clean labels
  }, [unit]);

  // Rebuild data when token / timeframe / multiplier / new trades.
  const data = useMemo(() => {
    void version;
    return buildCandles(token.recentTrades, tf, mult);
  }, [token, tf, mult, version]);

  useEffect(() => {
    const c = candleRef.current;
    const v = volRef.current;
    if (!c || !v) return;
    c.setData(
      data.map<CandlestickData<Time>>((k) => ({ time: k.time as UTCTimestamp, open: k.open, high: k.high, low: k.low, close: k.close })),
    );
    v.setData(
      data.map<HistogramData<Time>>((k) => ({ time: k.time as UTCTimestamp, value: k.volume, color: k.close >= k.open ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)" })),
    );
  }, [data]);

  useEffect(() => {
    chartRef.current?.timeScale().scrollToRealTime();
  }, [tf, token.mint]);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex h-[34px] items-center gap-1 border-b border-line bg-panel/90 px-2.5">
        {(Object.keys(TIMEFRAMES) as Timeframe[]).map((k) => (
          <button key={k} onClick={() => setTf(k)} className={`rounded px-2 py-1 text-[11px] font-semibold ${tf === k ? "bg-panel2 text-txt shadow-[inset_0_0_0_1px_var(--color-line2)]" : "text-mut hover:text-txt"}`}>
            {k}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line2" />
        <button onClick={() => setUnit("usd")} className={`rounded px-2 py-1 text-[11px] font-semibold ${unit === "usd" ? "bg-panel2 text-txt" : "text-mut"}`}>
          MC $
        </button>
        <button onClick={() => setUnit("sol")} className={`rounded px-2 py-1 text-[11px] font-semibold ${unit === "sol" ? "bg-panel2 text-txt" : "text-mut"}`}>
          MC SOL
        </button>
        <span className="ml-auto text-[11px] text-dim">
          {token.recentTrades.length} trades en mémoire · bougies construites on-chain
        </span>
      </div>
      <div ref={ref} className="min-h-0 flex-1" />
      {data.length === 0 && (
        <div className="pointer-events-none absolute inset-0 top-[34px] grid place-items-center text-xs text-dim">En attente du premier trade…</div>
      )}
    </div>
  );
}
