/**
 * Minimal, dependency-free base58 (Bitcoin alphabet) used for Solana public keys.
 * Kept separate from @solana/web3.js so the pure decoding layer can run anywhere
 * (unit tests, web workers, edge runtimes).
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = 58n;
const INDEX = new Map<string, bigint>();
for (let i = 0; i < ALPHABET.length; i++) INDEX.set(ALPHABET[i], BigInt(i));

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    const rem = n % BASE;
    n = n / BASE;
    out = ALPHABET[Number(rem)] + out;
  }
  // Preserve leading zero bytes as "1"
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

export function decodeBase58(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array();
  let n = 0n;
  for (const ch of str) {
    const v = INDEX.get(ch);
    if (v === undefined) throw new Error(`Invalid base58 character: ${ch}`);
    n = n * BASE + v;
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const ch of str) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

export function isValidPublicKey(str: string): boolean {
  try {
    return decodeBase58(str).length === 32;
  } catch {
    return false;
  }
}
