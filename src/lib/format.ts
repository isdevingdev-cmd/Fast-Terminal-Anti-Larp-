/** Compact number formatting used across the terminal: 1.2K, 3.4M, 1.2B. */
export function fmtCompact(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(digits)}K`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}`;
  if (abs >= 1) return `${sign}${abs.toFixed(digits)}`;
  return `${sign}${abs.toFixed(2)}`;
}

export function fmtUsd(n: number, digits = 1): string {
  return `$${fmtCompact(n, digits)}`;
}

export function fmtSol(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.001 && n !== 0) return `${n.toFixed(5)}`;
  return n.toFixed(digits);
}

export function fmtPct(p: number, digits = 1): string {
  if (!Number.isFinite(p)) return "—";
  const s = p > 0 ? "+" : p < 0 ? "−" : "";
  return `${s}${Math.abs(p).toFixed(digits)}%`;
}

/** Very small price → show significant digits with subscript-style zero count. */
export function fmtPrice(p: number): string {
  if (!Number.isFinite(p) || p === 0) return "—";
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  const s = p.toExponential(3); // e.g. 1.842e-7
  const [mant, exp] = s.split("e");
  const zeros = Math.abs(Number(exp)) - 1;
  return `0.0{${zeros}}${mant.replace(".", "")}`;
}

export function shortAddr(a: string, n = 4): string {
  if (!a) return "";
  return a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}j`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
