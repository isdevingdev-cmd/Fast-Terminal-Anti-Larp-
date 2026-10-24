export interface PumpCreateEvent {
  kind: "create";
  name: string;
  symbol: string;
  uri: string;
  mint: string;
  bondingCurve: string;
  creator: string;
  signature: string;
  slot: number;
  /** ms epoch when we received it */
  receivedAt: number;
}

export interface PumpTradeEvent {
  kind: "trade";
  mint: string;
  /** lamports */
  solAmount: bigint;
  /** token base units (10^6 per token) */
  tokenAmount: bigint;
  isBuy: boolean;
  user: string;
  /** unix seconds from the chain */
  timestamp: number;
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realSolReserves?: bigint;
  realTokenReserves?: bigint;
  signature: string;
  slot: number;
  receivedAt: number;
}

export interface PumpCompleteEvent {
  kind: "complete";
  user: string;
  mint: string;
  bondingCurve: string;
  timestamp: number;
  signature: string;
  slot: number;
  receivedAt: number;
}

export type PumpEvent = PumpCreateEvent | PumpTradeEvent | PumpCompleteEvent;

export type TokenStage = "new" | "bonding" | "migrated";

export interface TokenMetadata {
  image?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  github?: string;
  /** every link we found in the metadata, for the LarpCheck extractor */
  links: string[];
}

export interface TrackedToken {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  bondingCurve: string;
  creator: string;
  createdAt: number; // ms
  stage: TokenStage;
  metadata?: TokenMetadata;
  metadataStatus: "idle" | "loading" | "done" | "error";

  // live curve state
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  /** market cap in SOL */
  marketCapSol: number;
  /** bonding progress 0..1 */
  bondingProgress: number;
  lastTradeAt: number;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  volumeSol: number;
  /** distinct traders seen (approximation of holders while on the curve) */
  traders: Set<string>;
  /** net SOL bought by the creator wallet */
  devNetSol: number;
  devSold: boolean;
  /** share of supply bought in the creation slot (bundle heuristic), 0..1 */
  bundleShare: number;
  /** tokens held by creator (base units), tracked from trades */
  creatorTokenUnits: bigint;
  /** last N trades for sparkline / chart bootstrap */
  recentTrades: PumpTradeEvent[];
}
