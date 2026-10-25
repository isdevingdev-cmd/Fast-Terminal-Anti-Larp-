"use client";
import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { TrackedToken } from "@/lib/pump/types";
import { buildCandles, TIMEFRAMES, type Candle, type Timeframe } from "@/lib/chart/candles";
import { useMarket } from "@/lib/store/market";
import { useTokenStore } from "@/lib/store/tokens";
import { fmtCompact } from "@/lib/format";

const UP = "#22c55e";
const DN = "#ef4444";

function fmtValue(v: number, unit: "usd" | "sol"): string {
  if (!Number.isFinite(v) || v <= 0) return "";
  return unit === "usd" ? `$${fmtCompact(v, 2)}` : `${fmtCompact(v, 2)} SOL`;
}

function toBar(k: Candle) {
  return { time: k.time as UTCTimestamp, open: k.open, high: k.high, low: k.low, close: k.close };
}
function toVol(k: Candle) {
  return { time: k.time as UTCTimestamp, value: k.volume, color: k.close >= k.open ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)" };
}

/**
 * Market-cap candlestick chart built from on-chain trades.
 * Full rebuild on token / timeframe / unit change; incremental `update()` on new trades.
 */
export function TokenChart({ token }: { token: TrackedToken }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const dataRef = useRef<{ key: string; candles: Candle[]; trades: number }>({ key: "", candles: [], trades: 0 });
  const [tf, setTf] = useState<Timeframe>("5s");
  const [unit, setUnit] = useState<"usd" | "sol">("usd");
  const [count, setCount] = useState(0);
  const solUsd = useMarket((s) => s.solUsd);
  const version = useTokenStore((s) => s.version);
  const mult = unit === "usd" && solUsd ? solUsd : 1;
  const unitRef = useRef(unit);
  unitRef.current = unit;

  // Create the chart once per mount.
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8a93a6", fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: "#1b2130" }, horzLines: { color: "#1b2130" } },
      rightPriceScale: { borderColor: "#242c3d", scaleMargins: { top: 0.08, bottom: 0.25 } },
      timeScale: { borderColor: "#242c3d", timeVisible: true, secondsVisible: true, rightOffset: 3, barSpacing: 8, minBarSpacing: 2 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#8b5cf6", labelBackgroundColor: "#8b5cf6" },
        horzLine: { color: "#8b5cf6", labelBackgroundColor: "#8b5cf6" },
      },
      autoSize: true,
      localization: { priceFormatter: (p: number) => fmtValue(p, unitRef.current) },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DN,
      priceFormat: { type: "custom", minMove: 0.000001, formatter: (p: number) => fmtValue(p, unitRef.current) },
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "#8b5cf6",
    });
    const vol = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = vol;
    dataRef.current = { key: "", candles: [], trades: 0 };
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, []);

  // Feed data: rebuild when the key changes, otherwise update only the tail.
  useEffect(() => {
    const c = candleRef.current;
    const v = volRef.current;
    const chart = chartRef.current;
    if (!c || !v || !chart) return;
    const key = `${token.mint}|${tf}|${unit}|${mult.toFixed(4)}|${token.totalSupplyUnits}`;
    const trades = token.recentTrades;
    const prev = dataRef.current;

    if (prev.key !== key || trades.length < prev.trades) {
      const candles = buildCandles(trades, tf, mult, true, token.totalSupplyUnits);
      c.setData(candles.map(toBar));
      v.setData(candles.map(toVol));
      dataRef.current = { key, candles, trades: trades.length };
      setCount(candles.length);
      if (candles.length < 80) chart.timeScale().fitContent();
      else chart.timeScale().scrollToRealTime();
      return;
    }
    if (trades.length === prev.trades) return;
    // Incremental: rebuild only from the last known candle's bucket (cheap; trades are appended in order).
    const size = TIMEFRAMES[tf];
    const lastTime = prev.candles.length ? prev.candles[prev.candles.length - 1].time : 0;
    const newTrades = trades.slice(prev.trades);
    const outOfOrder = newTrades.some((t) => Math.floor(t.timestamp / size) * size < lastTime);
    if (outOfOrder) {
      const candles = buildCandles(trades, tf, mult, true, token.totalSupplyUnits);
      c.setData(candles.map(toBar));
      v.setData(candles.map(toVol));
      dataRef.current = { key, candles, trades: trades.length };
      setCount(candles.length);
      return;
    }
    // Recompute the tail candles from the last bucket onwards and push them with update().
    const tailStart = prev.candles.findIndex((k) => k.time === lastTime);
    const tailTrades = trades.filter((t) => Math.floor(t.timestamp / size) * size >= lastTime);
    const tail = buildCandles(tailTrades, tf, mult, true, token.totalSupplyUnits);
    if (tail.length && tailStart >= 0) {
      // the first tail candle is the same bucket as the last known candle: keep its original open
      tail[0].open = prev.candles[tailStart].open;
    }
    const merged = [...prev.candles.slice(0, Math.max(0, tailStart)), ...tail];
    for (const k of tail) {
      c.update(toBar(k));
      v.update(toVol(k));
    }
    dataRef.current = { key, candles: merged, trades: trades.length };
    setCount(merged.length);
  }, [token, token.recentTrades.length, tf, unit, mult, version]);

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
        <button onClick={() => chartRef.current?.timeScale().fitContent()} className="rounded px-2 py-1 text-[11px] font-semibold text-mut hover:text-txt" title="Ajuster à l'historique">
          ⤢ Tout
        </button>
        <button onClick={() => chartRef.current?.timeScale().scrollToRealTime()} className="rounded px-2 py-1 text-[11px] font-semibold text-mut hover:text-txt" title="Revenir au temps réel">
          ⇥ Live
        </button>
        <span className="ml-auto text-[11px] text-dim">
          {count} bougies · {token.recentTrades.length} trades on-chain
        </span>
      </div>
      <div ref={ref} className="min-h-0 flex-1" />
      {count === 0 && (
        <div className="pointer-events-none absolute inset-0 top-[34px] grid place-items-center text-xs text-dim">
          {token.recentTrades.length ? "Aucun trade valorisé pour l'instant" : "Chargement de l'historique on-chain…"}
        </div>
      )}
    </div>
  );
}
