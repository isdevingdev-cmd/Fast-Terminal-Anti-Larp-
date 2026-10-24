import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { decodeLogs, decodeEventBytes } from "../src/lib/pump/decoder";
import { decodeBase58, encodeBase58 } from "../src/lib/base58";
import { bondingProgress, marketCapSol, priceSol, quoteBuy, quoteSell, solToMigration } from "../src/lib/pump/curve";
import { INITIAL_VIRTUAL_SOL_LAMPORTS, INITIAL_VIRTUAL_TOKEN_UNITS } from "../src/lib/pump/constants";

const MINT = "Hq8zR4nL5pZ3WQ2pvm7m8z9Kq4jPUMPtEsT111111111"; // not a real key, just 32 bytes when decoded? use generated instead

function key(seed: number): { bytes: Uint8Array; b58: string } {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = (seed * 31 + i * 7) & 0xff;
  return { bytes, b58: encodeBase58(bytes) };
}

function disc(name: string): Uint8Array {
  return createHash("sha256").update(`event:${name}`).digest().subarray(0, 8);
}

function u64(v: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
}
function i64(v: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, v, true);
  return b;
}
function str(s: string): Uint8Array {
  const body = new TextEncoder().encode(s);
  const b = new Uint8Array(4 + body.length);
  new DataView(b.buffer).setUint32(0, body.length, true);
  b.set(body, 4);
  return b;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

test("base58 roundtrip", () => {
  const k = key(3);
  assert.equal(encodeBase58(decodeBase58(k.b58)), k.b58);
  assert.equal(decodeBase58(k.b58).length, 32);
  // Known vector: system program id
  assert.equal(encodeBase58(new Uint8Array(32)), "11111111111111111111111111111111");
});

test("decodes a TradeEvent with real reserves", () => {
  const mint = key(1);
  const user = key(2);
  const payload = concat(
    disc("TradeEvent"),
    mint.bytes,
    u64(1_500_000_000n), // 1.5 SOL
    u64(40_000_000_000_000n), // 40M tokens
    Uint8Array.of(1),
    user.bytes,
    i64(1_729_000_000n),
    u64(31_500_000_000n),
    u64(1_033_000_000_000_000n),
    u64(1_500_000_000n),
    u64(753_100_000_000_000n),
  );
  const b64 = Buffer.from(payload).toString("base64");
  assert.ok(b64.startsWith("vdt/007mYe4"), "trade discriminator prefix");
  const [ev] = decodeLogs([`Program data: ${b64}`], { signature: "sig", slot: 1 });
  assert.equal(ev.kind, "trade");
  if (ev.kind !== "trade") return;
  assert.equal(ev.mint, mint.b58);
  assert.equal(ev.user, user.b58);
  assert.equal(ev.isBuy, true);
  assert.equal(ev.solAmount, 1_500_000_000n);
  assert.equal(ev.virtualSolReserves, 31_500_000_000n);
  assert.equal(ev.realTokenReserves, 753_100_000_000_000n);
});

test("decodes a CreateEvent", () => {
  const mint = key(4), curve = key(5), creator = key(6);
  const payload = concat(disc("CreateEvent"), str("Clawd Agent"), str("CLAWD"), str("https://ipfs.io/ipfs/abc"), mint.bytes, curve.bytes, creator.bytes);
  const ev = decodeEventBytes(payload, { signature: "s", slot: 2 });
  assert.ok(ev && ev.kind === "create");
  if (!ev || ev.kind !== "create") return;
  assert.equal(ev.name, "Clawd Agent");
  assert.equal(ev.symbol, "CLAWD");
  assert.equal(ev.creator, creator.b58);
});

test("ignores unknown events and garbage", () => {
  assert.deepEqual(decodeLogs(["Program log: hello", "Program data: !!!", "Program data: AAAA"], { signature: "s", slot: 0 }), []);
});

test("curve math on a fresh curve", () => {
  const vSol = INITIAL_VIRTUAL_SOL_LAMPORTS;
  const vTok = INITIAL_VIRTUAL_TOKEN_UNITS;
  const p = priceSol(vSol, vTok);
  assert.ok(Math.abs(p - 30 / 1_073_000_000) < 1e-15);
  assert.ok(Math.abs(marketCapSol(vSol, vTok) - 27.96) < 0.01); // ~28 SOL initial MC
  assert.equal(bondingProgress(vTok), 0);
  assert.ok(Math.abs(solToMigration(vSol, vTok) - 85) < 0.1);
  const tokens = quoteBuy(vSol, vTok, 1_000_000_000n);
  assert.ok(tokens > 34_000_000_000_000n && tokens < 35_000_000_000_000n); // ~34.6M tokens for 1 SOL
  const back = quoteSell(vSol + 1_000_000_000n, vTok - tokens, tokens);
  assert.ok(back <= 1_000_000_000n && back > 999_000_000n);
});
