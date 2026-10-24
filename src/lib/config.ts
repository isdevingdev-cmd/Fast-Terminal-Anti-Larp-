/** Runtime configuration read from environment variables (NEXT_PUBLIC_* are inlined at build). */

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : fallback;
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "FAST";
export const TOKEN_TICKER = process.env.NEXT_PUBLIC_TOKEN_TICKER || "$FAST";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
export const RPC_WS_URL =
  process.env.NEXT_PUBLIC_RPC_WS_URL || RPC_URL.replace(/^http/, "ws");

/** Platform fee in basis points. 50 = 0.5 %. */
export const PLATFORM_FEE_BPS = num(process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS, 50);
export const FEE_WALLET = process.env.NEXT_PUBLIC_FEE_WALLET || "";

export const TRADE_PROVIDER = (process.env.NEXT_PUBLIC_TRADE_PROVIDER || "pumpportal") as
  | "pumpportal"
  | "native";

export const JITO_URL =
  process.env.NEXT_PUBLIC_JITO_URL || "https://mainnet.block-engine.jito.wtf/api/v1/transactions";

/** Public competitor fees used on the fee audit page (bps). Keep them honest and dated. */
export const COMPETITOR_FEES = [
  { name: "Photon", bps: 100, note: "1 % par trade" },
  { name: "Axiom", bps: 75, note: "0.75 % par trade (hors remises)" },
  { name: "BullX", bps: 100, note: "1 % par trade" },
  { name: "GMGN", bps: 100, note: "1 % par trade" },
] as const;

/** Speed presets → priority fee (SOL) and Jito tip (SOL). */
export const SPEED_PRESETS = {
  eco: { label: "Eco", priorityFeeSol: 0.0002, jitoTipSol: 0 },
  fast: { label: "Fast", priorityFeeSol: 0.001, jitoTipSol: 0.0005 },
  turbo: { label: "Turbo", priorityFeeSol: 0.005, jitoTipSol: 0.002 },
} as const;
export type SpeedPreset = keyof typeof SPEED_PRESETS;

/** Jito tip accounts (any of them works). */
export const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
];
