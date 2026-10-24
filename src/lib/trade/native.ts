"use client";
/**
 * EXPERIMENTAL — direct pump.fun bonding-curve instructions, no middleman fee.
 *
 * Builds `buy` / `sell` against program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
 * using the account layout of the 2025 program version (creator_vault included).
 * Only valid while the token is still on the curve (stage !== "migrated").
 *
 * Status: not yet exercised on mainnet from this codebase. Keep TRADE_PROVIDER=pumpportal
 * until this has been validated with small amounts on a fresh token.
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
import { PUMP_FEE_RECIPIENT, PUMP_PROGRAM_ID } from "../pump/constants";
import { quoteBuy, quoteSell } from "../pump/curve";
import type { TradeProvider, TradeRequest } from "./types";

const PROGRAM = new PublicKey(PUMP_PROGRAM_ID);
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const BUY_DISC = Uint8Array.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);
const SELL_DISC = Uint8Array.from([0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad]);

function u64le(v: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
}

export function pdaGlobal() {
  return PublicKey.findProgramAddressSync([Buffer.from("global")], PROGRAM)[0];
}
export function pdaBondingCurve(mint: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PROGRAM)[0];
}
export function pdaCreatorVault(creator: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("creator-vault"), creator.toBuffer()], PROGRAM)[0];
}
export function pdaEventAuthority() {
  return PublicKey.findProgramAddressSync([Buffer.from("__event_authority")], PROGRAM)[0];
}
export function ata(owner: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM,
  )[0];
}

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

function createAtaIdempotentIx(payer: PublicKey, owner: PublicKey, mint: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata(owner, mint), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // CreateIdempotent
  });
}

export function makeNativeProvider(connection: Connection): TradeProvider {
  return {
    id: "native",
    async buildSwap(req: TradeRequest, userPublicKey: string) {
      const user = new PublicKey(userPublicKey);
      const mint = new PublicKey(req.mint);
      const curvePk = pdaBondingCurve(mint);
      const info = await connection.getAccountInfo(curvePk, "processed");
      if (!info) throw new Error("Bonding curve introuvable (token migré ?)");
      const curve = parseCurveAccount(new Uint8Array(info.data));
      if (curve.complete) throw new Error("Courbe terminée : utiliser le provider pumpportal (PumpSwap)");
      if (!curve.creator) throw new Error("Ancienne version de courbe non supportée");

      const ixs: TransactionInstruction[] = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: Math.max(1, Math.floor((req.priorityFeeSol * 1e9 * 1e6) / 120_000)),
        }),
      ];

      const slip = BigInt(Math.round(req.slippagePct * 100)); // bps
      let data: Uint8Array;
      let keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
      const common = {
        global: pdaGlobal(),
        feeRecipient: new PublicKey(PUMP_FEE_RECIPIENT),
        curveAta: ata(curvePk, mint),
        userAta: ata(user, mint),
        creatorVault: pdaCreatorVault(curve.creator),
        eventAuthority: pdaEventAuthority(),
      };

      if (req.side === "buy") {
        const solIn = BigInt(Math.round(Number(req.amount) * 1e9));
        const tokensOut = quoteBuy(curve.virtualSolReserves, curve.virtualTokenReserves, solIn);
        const maxSol = solIn + (solIn * slip) / 10_000n;
        ixs.push(createAtaIdempotentIx(user, user, mint));
        data = new Uint8Array([...BUY_DISC, ...u64le(tokensOut), ...u64le(maxSol)]);
        keys = [
          { pubkey: common.global, isSigner: false, isWritable: false },
          { pubkey: common.feeRecipient, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: curvePk, isSigner: false, isWritable: true },
          { pubkey: common.curveAta, isSigner: false, isWritable: true },
          { pubkey: common.userAta, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
          { pubkey: common.creatorVault, isSigner: false, isWritable: true },
          { pubkey: common.eventAuthority, isSigner: false, isWritable: false },
          { pubkey: PROGRAM, isSigner: false, isWritable: false },
        ];
      } else {
        let tokenUnits: bigint;
        if (typeof req.amount === "string" && req.amount.endsWith("%")) {
          const bal = await connection.getTokenAccountBalance(common.userAta, "processed").catch(() => null);
          const have = BigInt(bal?.value.amount ?? "0");
          tokenUnits = (have * BigInt(Math.round(parseFloat(req.amount)))) / 100n;
        } else {
          tokenUnits = BigInt(Math.round(Number(req.amount) * 1e6));
        }
        if (tokenUnits <= 0n) throw new Error("Rien à vendre");
        const solOut = quoteSell(curve.virtualSolReserves, curve.virtualTokenReserves, tokenUnits);
        const minSol = solOut - (solOut * slip) / 10_000n;
        data = new Uint8Array([...SELL_DISC, ...u64le(tokenUnits), ...u64le(minSol < 0n ? 0n : minSol)]);
        keys = [
          { pubkey: common.global, isSigner: false, isWritable: false },
          { pubkey: common.feeRecipient, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: curvePk, isSigner: false, isWritable: true },
          { pubkey: common.curveAta, isSigner: false, isWritable: true },
          { pubkey: common.userAta, isSigner: false, isWritable: true },
          { pubkey: user, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: common.creatorVault, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
          { pubkey: common.eventAuthority, isSigner: false, isWritable: false },
          { pubkey: PROGRAM, isSigner: false, isWritable: false },
        ];
      }
      ixs.push(new TransactionInstruction({ programId: PROGRAM, keys, data: Buffer.from(data) }));

      const { blockhash } = await connection.getLatestBlockhash("processed");
      const msg = new TransactionMessage({ payerKey: user, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
      const tx = new VersionedTransaction(msg);
      return { txBase64: Buffer.from(tx.serialize()).toString("base64") };
    },
  };
}
