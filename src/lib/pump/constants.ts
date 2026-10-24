/**
 * pump.fun on-chain constants.
 * Source: pump.fun program (6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P) global config.
 * If pump.fun changes its curve parameters, only this file needs to move.
 */
export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_AMM_PROGRAM_ID = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
export const PUMP_FEE_RECIPIENT = "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM";

export const TOKEN_DECIMALS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const TOKEN_UNIT = 1_000_000n; // 10^TOKEN_DECIMALS

/** Total supply minted for every pump.fun token: 1,000,000,000 tokens. */
export const TOTAL_SUPPLY_TOKENS = 1_000_000_000n;
export const TOTAL_SUPPLY_UNITS = TOTAL_SUPPLY_TOKENS * TOKEN_UNIT;

/** Initial virtual reserves of a fresh bonding curve. */
export const INITIAL_VIRTUAL_SOL_LAMPORTS = 30n * LAMPORTS_PER_SOL; // 30 SOL
export const INITIAL_VIRTUAL_TOKEN_UNITS = 1_073_000_000n * TOKEN_UNIT; // 1.073B tokens
/** Tokens actually sellable on the curve before it completes. */
export const INITIAL_REAL_TOKEN_UNITS = 793_100_000n * TOKEN_UNIT; // 793.1M tokens

/** Anchor event discriminators = sha256("event:<Name>")[0..8] */
export const EVENT_DISCRIMINATORS = {
  TradeEvent: "bddb7fd34ee661ee",
  CreateEvent: "1b72a94ddeeb6376",
  CompleteEvent: "5f72619cd42e9808",
  SetParamsEvent: "dfc39ff63e308f83",
} as const;

/** Base64 prefixes of the same discriminators as they appear in "Program data:" logs. */
export const EVENT_LOG_PREFIXES = {
  TradeEvent: "vdt/007mYe4",
  CreateEvent: "G3KpTd7rY3Y",
  CompleteEvent: "X3JhnNQumAg",
} as const;
