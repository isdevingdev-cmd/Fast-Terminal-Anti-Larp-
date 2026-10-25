export interface PumpCreateEvent {
  kind: "create";
  name: string;
  symbol: string;
  uri: string;
  mint: string;
  bondingCurve: string;
  /** transaction signer that created the coin */
  user: string;
  /** on-chain creator (fee receiver); equals `user` on legacy events */
  creator: string;
  /** unix seconds from the chain (extended events only) */
  timestamp?: number;
  virtualTokenReserves?: bigint;
  virtualSolReserves?: bigint;
  realTokenReserves?: bigint;
  tokenTotalSupply?: bigint;
  /** undecoded trailing bytes of the extended event */
  tail?: Uint8Array;
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
  /** true when createdAt comes from the chain (CreateEvent / backfill), false when it is only "first seen" */
  createdKnown: boolean;
  /** total supply in token base units (1e15 = 1B tokens; Mayhem coins mint 2B but trade on a 1B curve) */
  totalSupplyUnits: bigint;
  /** initial virtual SOL of this coin's curve (varies per launch config) */
  initialVirtualSol: bigint;
  /** Mayhem mode (AI agent trades the coin for 24h; 2B minted) */
  mayhem?: boolean;
  source: "pump";
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
  /** trades with 0 SOL (agent / internal transfers) — counted, never priced */
  zeroSolTrades: number;
}
