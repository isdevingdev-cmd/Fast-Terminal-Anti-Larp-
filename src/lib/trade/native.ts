"use client";
/**
 * Native pump.fun bonding-curve provider — no middleman, no third-party fee.
 *
 * Builds the current `buy_exact_quote_in_v3` / `sell_v3` instructions of program
 * 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P (17 accounts, fee-config program, user volume
 * accumulator, wSOL legs). Account order and PDAs were verified against live mainnet
 * transactions on 2026-10-25 (see docs/pump-v3.md).
 *
 * Only valid while the coin is on the curve (stage !== "migrated"); PumpSwap is routed to the
 * PumpPortal provider until the native AMM leg lands.
 */
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { PUMP_PROGRAM_ID } from "../pump/constants";
import { quoteBuy, quoteSell } from "../pump/curve";
import type { TradeProvider, TradeRequest } from "./types";

export const PROGRAM = new PublicKey(PUMP_PROGRAM_ID);
export const PUMP_FEE_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
export const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

/** sha256("global:buy_exact_quote_in_v3")[0..8] / sha256("global:sell_v3")[0..8] */
const BUY_V3_DISC = Uint8Array.from([225, 247, 80, 30, 213, 179, 132, 136]);
const SELL_V3_DISC = Uint8Array.from([28, 146, 222, 119, 38, 196, 105, 213]);

/**
 * Buyback fee recipients: the 8 accounts of size 208 owned by the fee program.
 * Snapshot from mainnet; refreshed at runtime via getProgramAccounts when possible.
 */
export const BUYBACK_RECIPIENTS_SNAPSHOT = [
  "9M4giFFMxmFGXtc3feFzRai56WbBqehoSeRE5GK7gf7",
  "3BpXnfJaUTiwXnJNe7Ej1rcbzqTTQUvLShZaWazebsVR",
  "5YxQFdt3Tr9zJLvkFccqXVUwhdTWJQc1fFg2YPbxvxeD",
  "5cjcW9wExnJJiqgLjq7DEG75Pm6JBgE1hNv4B2vHXUW6",
  "5eHhjP8JaYkz83CWwvGU2uMUXefd3AazWGx4gpcuEEYD",
  "A7hAgCzFw14fejgCp387JUJRMNyz4j89JKnhtKU8piqW",
  "EHAAiTxcdDwQ3U4bU6YcMsQGaekdzLS3B5SmYo46kJtL",
  "GXPFM2caqTtQYC2cJ5yJRi9VDkpsYZXzYdwYpGnLmtDL",
];

let buybackCache: { at: number; list: string[] } | null = null;
async function buybackRecipients(connection: Connection): Promise<string[]> {
  if (buybackCache && Date.now() - buybackCache.at < 60 * 60_000) return buybackCache.list;
  try {
    const accs = await connection.getProgramAccounts(PUMP_FEE_PROGRAM, { filters: [{ dataSize: 208 }], dataSlice: { offset: 0, length: 0 } });
    const list = accs.map((a) => a.pubkey.toBase58());
    if (list.length) {
      buybackCache = { at: Date.now(), list };
      return list;
    }
  } catch {
    /* fall back to snapshot */
  }
  return BUYBACK_RECIPIENTS_SNAPSHOT;
}

function u64le(v: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
}

export const pdaGlobal = () => PublicKey.findProgramAddressSync([Buffer.from("global")], PROGRAM)[0];
export const pdaBondingCurve = (mint: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PROGRAM)[0];
export const pdaEventAuthority = () => PublicKey.findProgramAddressSync([Buffer.from("__event_authority")], PROGRAM)[0];
export const pdaUserVolumeAccumulator = (user: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("user_volume_accumulator"), user.toBuffer()], PROGRAM)[0];
export const pdaFeeConfig = () => PublicKey.findProgramAddressSync([Buffer.from("fee_config"), PROGRAM.toBuffer()], PUMP_FEE_PROGRAM)[0];
export const ata = (owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey = TOKEN_PROGRAM) =>
  PublicKey.findProgramAddressSync([owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM)[0];

export interface CurveAccount {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: PublicKey | null;
}

export function parseCurveAccount(data: Uint8Array): CurveAccount {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  const rd = () => {
    const x = v.getBigUint64(o, true);
    o += 8;
    return x;
  };
  const acc: CurveAccount = {
    virtualTokenReserves: rd(),
    virtualSolReserves: rd(),
    realTokenReserves: rd(),
    realSolReserves: rd(),
    tokenTotalSupply: rd(),
    complete: v.getUint8(o) === 1,
    creator: null,
  };
  o += 1;
  if (data.length >= o + 32) acc.creator = new PublicKey(data.subarray(o, o + 32));
  return acc;
}

function createAtaIdempotentIx(payer: PublicKey, owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata(owner, mint, tokenProgram), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // CreateIdempotent
  });
}

/** SPL Token `SyncNative` (instruction 17) on a wSOL account. */
function syncNativeIx(account: PublicKey): TransactionInstruction {
  return new TransactionInstruction({ programId: TOKEN_PROGRAM, keys: [{ pubkey: account, isSigner: false, isWritable: true }], data: Buffer.from([17]) });
}

/** SPL Token `CloseAccount` (instruction 9): returns the wSOL lamports to the owner. */
function closeAccountIx(account: PublicKey, dest: PublicKey, owner: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: Buffer.from([9]),
  });
}

export interface NativeBuildOptions {
  /** fee-side slack applied on top of the user's slippage when reserving SOL for a buy (pump fee ≈ 1 %) */
  feeSlackBps?: number;
}

/**
 * Build the instruction list for a v3 curve trade. Exported for simulation/testing.
 */
export async function buildNativeInstructions(
  connection: Connection,
  req: TradeRequest,
  user: PublicKey,
  opts: NativeBuildOptions = {},
): Promise<{ instructions: TransactionInstruction[]; curve: CurveAccount; tokenProgram: PublicKey }> {
  const mint = new PublicKey(req.mint);
  const curvePk = pdaBondingCurve(mint);
  const [curveInfo, mintInfo, buybacks] = await Promise.all([
    connection.getAccountInfo(curvePk, "processed"),
    connection.getAccountInfo(mint, "processed"),
    buybackRecipients(connection),
  ]);
  if (!curveInfo) throw new Error("Bonding curve introuvable (token migré ?)");
  if (!mintInfo) throw new Error("Mint introuvable");
  const curve = parseCurveAccount(new Uint8Array(curveInfo.data));
  if (curve.complete) throw new Error("Courbe terminée : ce token se trade sur PumpSwap (provider pumpportal)");
  const tokenProgram = mintInfo.owner.equals(TOKEN_2022_PROGRAM) ? TOKEN_2022_PROGRAM : TOKEN_PROGRAM;

  const userToken = ata(user, mint, tokenProgram);
  const userWsol = ata(user, WSOL, TOKEN_PROGRAM);
  const curveToken = ata(curvePk, mint, tokenProgram);
  const curveWsol = ata(curvePk, WSOL, TOKEN_PROGRAM);
  const buyback = new PublicKey(buybacks[Math.floor(Math.random() * buybacks.length)]);

  const keys = [
    { pubkey: pdaGlobal(), isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: WSOL, isSigner: false, isWritable: false },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: curvePk, isSigner: false, isWritable: true },
    { pubkey: curveToken, isSigner: false, isWritable: true },
    { pubkey: curveWsol, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: userToken, isSigner: false, isWritable: true },
    { pubkey: userWsol, isSigner: false, isWritable: true },
    { pubkey: pdaUserVolumeAccumulator(user), isSigner: false, isWritable: true },
    { pubkey: pdaFeeConfig(), isSigner: false, isWritable: false },
    { pubkey: buyback, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: pdaEventAuthority(), isSigner: false, isWritable: false },
    { pubkey: PROGRAM, isSigner: false, isWritable: false },
  ];

  const slipBps = BigInt(Math.round(Math.min(99, Math.max(0, req.slippagePct)) * 100));
  const priceMicro = Math.max(1, Math.floor((req.priorityFeeSol * 1e9 * 1e6) / 250_000));
  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priceMicro }),
    createAtaIdempotentIx(user, user, WSOL, TOKEN_PROGRAM),
  ];

  if (req.side === "buy") {
    const solIn = BigInt(Math.round(Number(req.amount) * 1e9));
    if (solIn <= 0n) throw new Error("Montant invalide");
    // Quote without fees, then apply the user's slippage (covers the ~1 % protocol+creator fee and price moves).
    const tokensOut = quoteBuy(curve.virtualSolReserves, curve.virtualTokenReserves, solIn);
    const minTokens = tokensOut - (tokensOut * (slipBps + BigInt(opts.feeSlackBps ?? 150))) / 10_000n;
    // Fund the wSOL leg with the full spend; whatever the program does not take comes back on close.
    ixs.push(
      SystemProgram.transfer({ fromPubkey: user, toPubkey: userWsol, lamports: Number(solIn) }),
      syncNativeIx(userWsol),
      createAtaIdempotentIx(user, user, mint, tokenProgram),
      new TransactionInstruction({
        programId: PROGRAM,
        keys,
        data: Buffer.from([...BUY_V3_DISC, ...u64le(solIn), ...u64le(minTokens < 1n ? 1n : minTokens), 1 /* track_volume */]),
      }),
    );
  } else {
    let tokenUnits: bigint;
    if (typeof req.amount === "string" && req.amount.endsWith("%")) {
      const bal = await connection.getTokenAccountBalance(userToken, "processed").catch(() => null);
      const have = BigInt(bal?.value.amount ?? "0");
      tokenUnits = (have * BigInt(Math.round(parseFloat(req.amount)))) / 100n;
    } else tokenUnits = BigInt(Math.round(Number(req.amount) * 1e6));
    if (tokenUnits <= 0n) throw new Error("Rien à vendre");
    const solOut = quoteSell(curve.virtualSolReserves, curve.virtualTokenReserves, tokenUnits);
    const minSol = solOut - (solOut * (slipBps + BigInt(opts.feeSlackBps ?? 150))) / 10_000n;
    ixs.push(
      new TransactionInstruction({
        programId: PROGRAM,
        keys,
        data: Buffer.from([...SELL_V3_DISC, ...u64le(tokenUnits), ...u64le(minSol < 1n ? 1n : minSol)]),
      }),
    );
  }
  // Unwrap: close the wSOL account back to the user (returns change on buys, proceeds on sells).
  ixs.push(closeAccountIx(userWsol, user, user));
  return { instructions: ixs, curve, tokenProgram };
}

export function makeNativeProvider(connection: Connection): TradeProvider {
  return {
    id: "native",
    async buildSwap(req: TradeRequest, userPublicKey: string) {
      const user = new PublicKey(userPublicKey);
      const { instructions } = await buildNativeInstructions(connection, req, user);
      const { blockhash } = await connection.getLatestBlockhash("processed");
      const msg = new TransactionMessage({ payerKey: user, recentBlockhash: blockhash, instructions }).compileToV0Message();
      const tx = new VersionedTransaction(msg);
      return { txBase64: Buffer.from(tx.serialize()).toString("base64") };
    },
  };
}
