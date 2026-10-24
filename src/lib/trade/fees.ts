import { COMPETITOR_FEES, PLATFORM_FEE_BPS } from "../config";

export function platformFeeSol(solAmount: number, bps = PLATFORM_FEE_BPS): number {
  return (solAmount * bps) / 10_000;
}

/** Fee comparison for a given trade size (SOL). */
export function compareFees(solAmount: number, ourBps = PLATFORM_FEE_BPS) {
  const ours = platformFeeSol(solAmount, ourBps);
  return {
    ours,
    oursBps: ourBps,
    competitors: COMPETITOR_FEES.map((c) => ({
      name: c.name,
      bps: c.bps,
      fee: platformFeeSol(solAmount, c.bps),
      savings: platformFeeSol(solAmount, c.bps) - ours,
    })),
  };
}
