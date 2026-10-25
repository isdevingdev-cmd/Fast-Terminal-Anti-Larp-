"use client";
/**
 * pump.fun ecosystem router: bonding curve (v3 instructions) and PumpSwap AMM, quoted with the
 * on-chain fee configs so `minOut` is tight and trades do not fail on fee slack.
 *
 * Account layouts and instruction shapes follow the public pump.fun / PumpSwap programs; the
 * decoding offsets were cross-checked against motion-vault (motion.gift, used with its author's
 * permission) and against live mainnet transactions (docs/pump-v3.md).
 */
import { Connection, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";

export const P = {
  system: SystemProgram.programId,
  token: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  token22: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
  ata: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  wsol: new PublicKey("So11111111111111111111111111111111111111112"),
  pump: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
  pamm: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
  fees: new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"),
  pumpFeeConfig: new PublicKey("8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt"),
  ammFeeConfig: new PublicKey("5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx"),
  ammGlobalConfig: new PublicKey("ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw"),
};

/** The 8 buyback fee recipients (fee-program accounts of size 208). Any of them is accepted. */
export const BUYBACK = [
  "5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD",
  "9M4giFFMxmFGXtc3feFzRai56WbBqehoSeRE5GK7gf7",
  "GXPFM2caqTtQYC2cJ5yJRi9VDkpsYZXzYdwYpGnLmtDL",
  "3BpXnfJaUTiwXnJNe7Ej1rcbzqTTQUvLShZaWazebsVR",
  "5cjcW9wExnJJiqgLjq7DEG75Pm6JBgE1hNv4B2vHXUW6",
  "EHAAiTxcdDwQ3U4bU6YcMsQGaekdzLS3B5SmYo46kJtL",
  "5eHhjP8JaYkz83CWwvGU2uMUXefd3AazWGx4gpcuEEYD",
  "A7hAgCzFw14fejgCp387JUJRMNyz4j89JKnhtKU8piqW",
].map((k) => new PublicKey(k));

const DISC = {
  buyV3: Uint8Array.from([225, 247, 80, 30, 213, 179, 132, 136]),
  sellV3: Uint8Array.from([28, 146, 222, 119, 38, 196, 105, 213]),
  ammBuy: Uint8Array.from([194, 171, 28, 70, 104, 77, 91, 47]),
  ammSell: Uint8Array.from([93, 246, 130, 60, 231, 233, 64, 178]),
};

const te = new TextEncoder();
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const u64 = (v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
};
const rdU64 = (d: Uint8Array, o: number) => new DataView(d.buffer, d.byteOffset).getBigUint64(o, true);
const rdI128 = (d: Uint8Array, o: number) => {
  const v = new DataView(d.buffer, d.byteOffset);
  return (v.getBigInt64(o + 8, true) << 64n) | v.getBigUint64(o, true);
};
const rdKey = (d: Uint8Array, o: number) => new PublicKey(d.subarray(o, o + 32));

export const pda = (seeds: (Uint8Array | Buffer)[], program: PublicKey) => PublicKey.findProgramAddressSync(seeds, program)[0];
export const ataOf = (owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey = P.token) =>
  pda([owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()], P.ata);
export const curveOf = (mint: PublicKey) => pda([te.encode("bonding-curve"), mint.toBuffer()], P.pump);
export const pumpGlobal = () => pda([te.encode("global")], P.pump);
export const pumpEventAuthority = () => pda([te.encode("__event_authority")], P.pump);
export const pumpUva = (user: PublicKey) => pda([te.encode("user_volume_accumulator"), user.toBuffer()], P.pump);
export const ammEventAuthority = () => pda([te.encode("__event_authority")], P.pamm);
export const ammUva = (user: PublicKey) => pda([te.encode("user_volume_accumulator"), user.toBuffer()], P.pamm);
/** Canonical PumpSwap pool of a migrated coin: seeds ["pool", u16 0, pool-authority(mint), mint, wSOL]. */
export function canonicalPool(mint: PublicKey) {
  const authority = pda([te.encode("pool-authority"), mint.toBuffer()], P.pump);
  return pda([te.encode("pool"), Uint8Array.of(0, 0), authority.toBuffer(), mint.toBuffer(), P.wsol.toBuffer()], P.pamm);
}

// ── curve & fee config ───────────────────────────────────────────────────────
export interface Curve {
  vTok: bigint;
  vQuote: bigint;
  realTok: bigint;
  realQuote: bigint;
  supply: bigint;
  complete: boolean;
  creator: PublicKey;
  mayhem: boolean;
  cashback: boolean;
  quoteMint: PublicKey;
  creatorFeeBps: bigint;
}
export function decodeCurve(d: Uint8Array): Curve {
  return {
    vTok: rdU64(d, 8),
    vQuote: rdU64(d, 16),
    realTok: rdU64(d, 24),
    realQuote: rdU64(d, 32),
    supply: rdU64(d, 40),
    complete: d[48] === 1,
    creator: rdKey(d, 49),
    mayhem: d.length > 81 && d[81] === 1,
    cashback: d.length > 82 && d[82] === 1,
    quoteMint: d.length >= 115 ? rdKey(d, 83) : P.system,
    creatorFeeBps: d.length >= 123 ? rdU64(d, 115) : 0n,
  };
}

interface Tier {
  threshold: bigint;
  lp: bigint;
  protocol: bigint;
  creator: bigint;
}
interface FeeConfig {
  flat: Tier;
  tiers: Tier[];
}
export function decodeFeeConfig(d: Uint8Array): FeeConfig {
  let o = 8 + 1 + 32;
  const fees = () => {
    const lp = rdU64(d, o),
      protocol = rdU64(d, o + 8),
      creator = rdU64(d, o + 16);
    o += 24;
    return { lp, protocol, creator };
  };
  const flat = { threshold: 0n, ...fees() };
  const n = new DataView(d.buffer, d.byteOffset).getUint32(o, true);
  o += 4;
  const tiers: Tier[] = [];
  for (let i = 0; i < n && i < 64; i++) {
    const lo = rdU64(d, o),
      hi = rdU64(d, o + 8);
    o += 16;
    tiers.push({ threshold: (hi << 64n) | lo, ...fees() });
  }
  return { flat, tiers };
}
function tierFor(cfg: FeeConfig, mcapLamports: bigint): Tier {
  const t = cfg.tiers;
  if (!t.length) return cfg.flat;
  if (mcapLamports < t[0].threshold) return t[0];
  for (let i = t.length - 1; i >= 0; i--) if (mcapLamports >= t[i].threshold) return t[i];
  return t[0];
}
const ceilFee = (amount: bigint, bps: bigint) => (amount * bps + 9999n) / 10000n;

const feeCfgCache = new Map<string, { at: number; v: FeeConfig }>();
async function feeConfig(connection: Connection, addr: PublicKey): Promise<FeeConfig> {
  const k = addr.toBase58();
  const hit = feeCfgCache.get(k);
  if (hit && Date.now() - hit.at < 300_000) return hit.v;
  const acc = await connection.getAccountInfo(addr, "processed");
  if (!acc) throw new Error("fee config introuvable");
  const v = decodeFeeConfig(new Uint8Array(acc.data));
  feeCfgCache.set(k, { at: Date.now(), v });
  return v;
}

// ── route ────────────────────────────────────────────────────────────────────
export interface Route {
  mint: PublicKey;
  venue: "pump" | "pumpswap";
  tokenProgram: PublicKey;
  decimals: number;
  mayhem: boolean;
  cashback: boolean;
  curve?: Curve;
  pool?: PublicKey;
  baseVault?: PublicKey;
  quoteVault?: PublicKey;
}

/** Read mint, curve and canonical pool in one round trip and decide the venue. */
export async function loadRoute(connection: Connection, mintStr: string): Promise<Route> {
  const mint = new PublicKey(mintStr);
  const curvePk = curveOf(mint);
  const poolPk = canonicalPool(mint);
  const [mintAcc, curveAcc, poolAcc] = await connection.getMultipleAccountsInfo([mint, curvePk, poolPk], "processed");
  if (!mintAcc) throw new Error("Mint inconnu");
  const tokenProgram = mintAcc.owner;
  if (!tokenProgram.equals(P.token) && !tokenProgram.equals(P.token22)) throw new Error("Pas un token SPL");
  const decimals = mintAcc.data[44];
  if (!curveAcc || !curveAcc.owner.equals(P.pump)) throw new Error("Pas un coin pump.fun (aucune bonding curve)");
  const curve = decodeCurve(new Uint8Array(curveAcc.data));
  if (!curve.quoteMint.equals(P.system) && !curve.quoteMint.equals(P.wsol)) throw new Error("Ce coin est coté dans un autre token que SOL");
  if (!curve.complete) return { mint, venue: "pump", tokenProgram, decimals, mayhem: curve.mayhem, cashback: curve.cashback, curve };
  if (!poolAcc || !poolAcc.owner.equals(P.pamm)) throw new Error("Courbe terminée, pool PumpSwap pas encore ouvert — réessaie dans quelques secondes");
  const pd = new Uint8Array(poolAcc.data);
  if (!rdKey(pd, 43).equals(mint) || !rdKey(pd, 75).equals(P.wsol)) throw new Error("Le pool ne correspond pas au coin");
  const cashback = pd[8 + 1 + 2 + 32 * 6 + 8 + 32 + 1] === 1;
  return {
    mint,
    venue: "pumpswap",
    tokenProgram,
    decimals,
    mayhem: curve.mayhem,
    cashback,
    curve,
    pool: poolPk,
    baseVault: rdKey(pd, 139),
    quoteVault: rdKey(pd, 171),
  };
}

// ── quotes ───────────────────────────────────────────────────────────────────
export interface Quote {
  out: bigint;
  feeBps: bigint;
}

export async function quotePump(connection: Connection, route: Route, side: "buy" | "sell", amountIn: bigint): Promise<Quote> {
  // Re-read the curve at quote time: reserves move every slot.
  const curveAcc = await connection.getAccountInfo(curveOf(route.mint), "processed");
  if (!curveAcc) throw new Error("Courbe introuvable");
  const c = decodeCurve(new Uint8Array(curveAcc.data));
  if (c.complete) throw new Error("Courbe terminée : le trading passe sur PumpSwap");
  const cfg = await feeConfig(connection, P.pumpFeeConfig);
  const supply = c.mayhem ? c.supply : 1_000_000_000_000_000n;
  const mcap = c.vTok > 0n ? (c.vQuote * supply) / c.vTok : 0n;
  const tier = tierFor(cfg, mcap);
  const creatorBps = c.creator.equals(P.system) ? 0n : c.creatorFeeBps > 0n ? c.creatorFeeBps : tier.creator;
  const protocolBps = tier.protocol;
  const fees = (x: bigint) => ceilFee(x, protocolBps) + ceilFee(x, creatorBps);
  const feeBps = protocolBps + creatorBps;
  if (side === "buy") {
    let net = feeBps === 0n ? amountIn : (amountIn * 10000n) / (feeBps + 10000n);
    const cost = net + fees(net);
    if (cost > amountIn) net -= cost - amountIn;
    if (net <= 1n) return { out: 0n, feeBps };
    let tokens = ((net - 1n) * c.vTok) / (c.vQuote + net - 1n);
    if (tokens > c.realTok && !c.mayhem) tokens = c.realTok;
    return { out: tokens, feeBps };
  }
  const gross = (amountIn * c.vQuote) / (c.vTok + amountIn);
  return { out: gross - fees(gross), feeBps };
}

export async function quoteAmm(connection: Connection, route: Route, side: "buy" | "sell", amountIn: bigint): Promise<Quote> {
  if (!route.pool || !route.baseVault || !route.quoteVault) throw new Error("Route PumpSwap incomplète");
  const [poolAcc, bv, qv] = await connection.getMultipleAccountsInfo([route.pool, route.baseVault, route.quoteVault], "processed");
  if (!poolAcc || !bv || !qv) throw new Error("Pool ou vaults introuvables");
  const pd = new Uint8Array(poolAcc.data);
  const vq = rdI128(pd, 8 + 1 + 2 + 32 * 6 + 8 + 32 + 1 + 1);
  const base = rdU64(new Uint8Array(bv.data), 64);
  const quote = rdU64(new Uint8Array(qv.data), 64) + vq;
  let tier: Tier = { threshold: 0n, lp: 20n, protocol: 5n, creator: 5n };
  try {
    const cfg = await feeConfig(connection, P.ammFeeConfig);
    const mcap = base > 0n ? (quote * 1_000_000_000_000_000n) / base : 0n;
    tier = tierFor(cfg, mcap);
  } catch {
    /* default tier */
  }
  const totalBps = tier.lp + tier.protocol + tier.creator;
  if (side === "buy") {
    const net = (amountIn * 10000n) / (10000n + totalBps);
    return { out: (base * net) / (quote + net), feeBps: totalBps };
  }
  const gross = (quote * amountIn) / (base + amountIn);
  return { out: gross - ceilFee(gross, totalBps), feeBps: totalBps };
}

// ── instructions ─────────────────────────────────────────────────────────────
type Meta = { pubkey: PublicKey; isSigner: boolean; isWritable: boolean };
const meta = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean): Meta => ({ pubkey, isSigner, isWritable });

const ataCreate = (payer: PublicKey, owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey) =>
  new TransactionInstruction({
    programId: P.ata,
    keys: [meta(payer, true, true), meta(ataOf(owner, mint, tokenProgram), false, true), meta(owner, false, false), meta(mint, false, false), meta(P.system, false, false), meta(tokenProgram, false, false)],
    data: Buffer.from([1]),
  });
const syncNative = (acc: PublicKey) => new TransactionInstruction({ programId: P.token, keys: [meta(acc, false, true)], data: Buffer.from([17]) });
const closeAcc = (acc: PublicKey, dest: PublicKey, owner: PublicKey) =>
  new TransactionInstruction({ programId: P.token, keys: [meta(acc, false, true), meta(dest, false, true), meta(owner, true, false)], data: Buffer.from([9]) });

export function pumpIxs(user: PublicKey, r: Route, side: "buy" | "sell", amount: bigint, minOut: bigint): TransactionInstruction[] {
  const curve = curveOf(r.mint);
  const keys: Meta[] = [
    meta(pumpGlobal(), false, false),
    meta(r.mint, false, false),
    meta(P.wsol, false, false),
    meta(r.tokenProgram, false, false),
    meta(P.token, false, false),
    meta(curve, false, true),
    meta(ataOf(curve, r.mint, r.tokenProgram), false, true),
    meta(ataOf(curve, P.wsol, P.token), false, true),
    meta(user, true, true),
    meta(ataOf(user, r.mint, r.tokenProgram), false, true),
    meta(ataOf(user, P.wsol, P.token), false, true),
    meta(pumpUva(user), false, true),
    meta(P.pumpFeeConfig, false, false),
    meta(pick(BUYBACK), false, true),
    meta(P.system, false, false),
    meta(pumpEventAuthority(), false, false),
    meta(P.pump, false, false),
  ];
  const data = Buffer.from([...(side === "buy" ? DISC.buyV3 : DISC.sellV3), ...u64(amount), ...u64(minOut)]);
  const out: TransactionInstruction[] = [];
  if (side === "buy") out.push(ataCreate(user, user, r.mint, r.tokenProgram));
  out.push(new TransactionInstruction({ programId: P.pump, keys, data }));
  return out;
}

export function ammIxs(user: PublicKey, r: Route, side: "buy" | "sell", amount: bigint, minOut: bigint): TransactionInstruction[] {
  if (!r.pool || !r.baseVault || !r.quoteVault) throw new Error("Route PumpSwap incomplète");
  const wsolAta = ataOf(user, P.wsol, P.token);
  const keys: Meta[] = [
    meta(r.pool, false, true),
    meta(user, true, true),
    meta(P.ammGlobalConfig, false, false),
    meta(r.mint, false, false),
    meta(P.wsol, false, false),
    meta(ataOf(user, r.mint, r.tokenProgram), false, true),
    meta(wsolAta, false, true),
    meta(r.baseVault, false, true),
    meta(r.quoteVault, false, true),
    meta(r.tokenProgram, false, false),
    meta(P.token, false, false),
    meta(P.system, false, false),
    meta(ammUva(user), false, true),
    meta(P.ammFeeConfig, false, false),
    meta(ataOf(pick(BUYBACK), P.wsol, P.token), false, true),
    meta(ammEventAuthority(), false, false),
    meta(P.pamm, false, false),
  ];
  const data = Buffer.from([...(side === "buy" ? DISC.ammBuy : DISC.ammSell), ...u64(amount), ...u64(minOut)]);
  const out: TransactionInstruction[] = [ataCreate(user, user, P.wsol, P.token)];
  if (side === "buy") {
    out.push(
      SystemProgram.transfer({ fromPubkey: user, toPubkey: wsolAta, lamports: Number(amount) }),
      syncNative(wsolAta),
      ataCreate(user, user, r.mint, r.tokenProgram),
    );
  }
  out.push(new TransactionInstruction({ programId: P.pamm, keys, data }), closeAcc(wsolAta, user, user));
  return out;
}

const slipMin = (v: bigint, slippagePct: number) => (v * BigInt(Math.floor((100 - Math.min(99, Math.max(0, slippagePct))) * 100))) / 10000n;

/** Quote + instructions for one trade on the right venue. */
export async function buildTradeIxs(
  connection: Connection,
  route: Route,
  user: PublicKey,
  side: "buy" | "sell",
  amount: bigint,
  slippagePct: number,
): Promise<{ ixs: TransactionInstruction[]; expected: bigint; minOut: bigint; feeBps: bigint }> {
  const q = route.venue === "pump" ? await quotePump(connection, route, side, amount) : await quoteAmm(connection, route, side, amount);
  let minOut = slipMin(q.out, slippagePct);
  if (minOut <= 0n) minOut = 1n;
  const ixs = route.venue === "pump" ? pumpIxs(user, route, side, amount, minOut) : ammIxs(user, route, side, amount, minOut);
  return { ixs, expected: q.out, minOut, feeBps: q.feeBps };
}

