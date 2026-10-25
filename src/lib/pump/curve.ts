import {
  INITIAL_REAL_TOKEN_UNITS,
  INITIAL_VIRTUAL_TOKEN_UNITS,
  LAMPORTS_PER_SOL,
  TOKEN_UNIT,
  TOTAL_SUPPLY_TOKENS,
} from "./constants";

/** Price of ONE token in SOL from the virtual reserves. */
export function priceSol(vSol: bigint, vTokens: bigint): number {
  if (vTokens === 0n) return 0;
  // (vSol / 1e9) / (vTokens / 1e6)
  return (Number(vSol) / 1e9) / (Number(vTokens) / 1e6);
}

/** Market cap in SOL = price * total supply (default 1B tokens; pass the coin's supply in base units to override). */
export function marketCapSol(vSol: bigint, vTokens: bigint, supplyUnits?: bigint): number {
  const supplyTokens = supplyUnits !== undefined && supplyUnits > 0n ? Number(supplyUnits) / 1e6 : Number(TOTAL_SUPPLY_TOKENS);
  return priceSol(vSol, vTokens) * supplyTokens;
}

/**
 * Bonding curve progress 0..1.
 * Tokens sold so far = initialVirtualTokens - virtualTokens; the curve completes
 * when all 793.1M "real" tokens are sold.
 */
export function bondingProgress(vTokens: bigint): number {
  const sold = INITIAL_VIRTUAL_TOKEN_UNITS - vTokens;
  if (sold <= 0n) return 0;
  const p = Number(sold) / Number(INITIAL_REAL_TOKEN_UNITS);
  return Math.max(0, Math.min(1, p));
}

/** SOL still needed on the curve before migration. */
export function solToMigration(vSol: bigint, vTokens: bigint): number {
  // constant product k = vSol * vTokens; at completion vTokens = initial - real
  const k = vSol * vTokens;
  const finalTokens = INITIAL_VIRTUAL_TOKEN_UNITS - INITIAL_REAL_TOKEN_UNITS;
  if (finalTokens <= 0n) return 0;
  const finalSol = k / finalTokens;
  const remaining = finalSol - vSol;
  return remaining > 0n ? Number(remaining) / 1e9 : 0;
}

/** Tokens (base units) received for `solIn` lamports on a constant-product curve, before fees. */
export function quoteBuy(vSol: bigint, vTokens: bigint, solIn: bigint): bigint {
  if (solIn <= 0n) return 0n;
  const k = vSol * vTokens;
  const newSol = vSol + solIn;
  const newTokens = k / newSol + 1n;
  return vTokens - newTokens;
}

/** Lamports received for `tokensIn` base units, before fees. */
export function quoteSell(vSol: bigint, vTokens: bigint, tokensIn: bigint): bigint {
  if (tokensIn <= 0n) return 0n;
  const k = vSol * vTokens;
  const newTokens = vTokens + tokensIn;
  const newSol = k / newTokens;
  return vSol - newSol;
}

export function lamportsToSol(l: bigint): number {
  return Number(l) / Number(LAMPORTS_PER_SOL);
}

export function unitsToTokens(u: bigint): number {
  return Number(u) / Number(TOKEN_UNIT);
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 1e9));
}
