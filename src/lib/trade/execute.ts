"use client";
import {
  AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { JITO_TIP_ACCOUNTS, TRADE_PROVIDER } from "../config";
import { pumpPortalProvider } from "./pumpportal";
import { makeNativeProvider } from "./native";
import type { TradeProvider, TradeRequest, TradeResult } from "./types";
import { usePositions } from "../store/positions";

function pickProvider(connection: Connection): TradeProvider {
  return TRADE_PROVIDER === "native" ? makeNativeProvider(connection) : pumpPortalProvider;
}

async function loadLookupTables(connection: Connection, tx: VersionedTransaction): Promise<AddressLookupTableAccount[]> {
  const lookups = tx.message.addressTableLookups;
  if (!lookups.length) return [];
  const accounts = await Promise.all(
    lookups.map(async (l) => (await connection.getAddressLookupTable(l.accountKey)).value),
  );
  return accounts.filter((a): a is AddressLookupTableAccount => a !== null);
}

/**
 * Append platform fee (and Jito tip) transfers to a provider-built transaction,
 * refresh the blockhash and sign. Returns the signed transaction.
 */
async function finalizeTransaction(
  connection: Connection,
  txBase64: string,
  payer: Keypair,
  req: TradeRequest,
  solBasis: number,
): Promise<VersionedTransaction> {
  const tx = VersionedTransaction.deserialize(Buffer.from(txBase64, "base64"));
  const luts = await loadLookupTables(connection, tx);
  const msg = TransactionMessage.decompile(tx.message, { addressLookupTableAccounts: luts });

  const feeLamports = Math.floor((solBasis * req.platformFeeBps * 1e9) / 10_000);
  if (feeLamports > 0 && req.feeWallet) {
    msg.instructions.push(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: new PublicKey(req.feeWallet), lamports: feeLamports }),
    );
  }
  if (req.mevProtect && req.jitoTipSol > 0) {
    const tip = JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
    msg.instructions.push(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: new PublicKey(tip), lamports: Math.floor(req.jitoTipSol * 1e9) }),
    );
  }
  const { blockhash } = await connection.getLatestBlockhash("processed");
  msg.recentBlockhash = blockhash;
  const signed = new VersionedTransaction(msg.compileToV0Message(luts));
  signed.sign([payer]);
  return signed;
}

async function sendViaJito(signed: VersionedTransaction): Promise<string> {
  const res = await fetch("/api/trade/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ txBase64: Buffer.from(signed.serialize()).toString("base64") }),
  });
  const json = (await res.json()) as { signature?: string; error?: string };
  if (!res.ok || !json.signature) throw new Error(json.error ?? "jito send failed");
  return json.signature;
}

export interface ExecuteContext {
  connection: Connection;
  payer: Keypair;
  /** SOL amount the platform fee is computed on (buy amount, or estimated sell proceeds) */
  solBasis: number;
  /** for position bookkeeping */
  tokenSymbol?: string;
  onStatus?: (s: string) => void;
}

export async function executeTrade(req: TradeRequest, ctx: ExecuteContext): Promise<TradeResult> {
  const { connection, payer, onStatus } = ctx;
  const provider = pickProvider(connection);
  const t0 = performance.now();

  onStatus?.("Construction de la transaction…");
  const { txBase64 } = await provider.buildSwap(req, payer.publicKey.toBase58());

  onStatus?.("Signature…");
  const signed = await finalizeTransaction(connection, txBase64, payer, req, ctx.solBasis);

  onStatus?.(req.mevProtect ? "Envoi via Jito…" : "Envoi…");
  let signature: string;
  let sentVia: TradeResult["sentVia"] = "rpc";
  if (req.mevProtect && req.jitoTipSol > 0) {
    try {
      signature = await sendViaJito(signed);
      sentVia = "jito";
    } catch (e) {
      console.warn("[trade] jito failed, falling back to RPC", e);
      signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 3 });
    }
  } else {
    signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 3 });
  }
  const sentAt = Date.now();
  const result: TradeResult = { signature, sentVia, sentAt };

  usePositions.getState().recordPending({
    signature,
    wallet: payer.publicKey.toBase58(),
    mint: req.mint,
    side: req.side,
    solAmount: ctx.solBasis,
    symbol: ctx.tokenSymbol ?? "",
    sentAt,
  });

  onStatus?.(`Envoyé en ${Math.round(performance.now() - t0)} ms — confirmation…`);
  // Confirm in the background; the UI already shows the signature.
  void (async () => {
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("processed");
      const conf = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      usePositions.getState().resolvePending(signature, conf.value.err ? "failed" : "confirmed");
      onStatus?.(conf.value.err ? "Transaction échouée on-chain" : "Confirmé ✓");
    } catch (e) {
      usePositions.getState().resolvePending(signature, "failed");
      onStatus?.(`Confirmation incertaine : ${(e as Error).message}`);
    }
  })();

  return result;
}
