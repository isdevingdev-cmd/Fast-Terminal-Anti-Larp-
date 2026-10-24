export type TradeSide = "buy" | "sell";
export type Pool = "pump" | "pump-amm" | "raydium" | "auto";

export interface TradeRequest {
  side: TradeSide;
  mint: string;
  /** buy: SOL to spend. sell: token amount (whole tokens) or percentage string like "50%" */
  amount: number | `${number}%`;
  slippagePct: number;
  priorityFeeSol: number;
  jitoTipSol: number;
  mevProtect: boolean;
  pool: Pool;
  /** platform fee in bps, applied on the SOL side */
  platformFeeBps: number;
  feeWallet: string;
}

export interface TradeQuote {
  /** SOL leaving (buy) or entering (sell) the wallet, excluding network fees */
  solAmount: number;
  platformFeeSol: number;
  priorityFeeSol: number;
  jitoTipSol: number;
  /** total SOL cost for a buy = amount + fees */
  totalSol: number;
  /** Estimated tokens received (buy) in whole tokens */
  estTokens?: number;
}

export interface TradeResult {
  signature: string;
  sentVia: "rpc" | "jito";
  sentAt: number;
  confirmedAt?: number;
  error?: string;
}

export interface TradeProvider {
  id: string;
  /** Returns an unsigned serialized transaction (base64) for the swap itself, without platform fee. */
  buildSwap(req: TradeRequest, userPublicKey: string): Promise<{ txBase64: string }>;
}
