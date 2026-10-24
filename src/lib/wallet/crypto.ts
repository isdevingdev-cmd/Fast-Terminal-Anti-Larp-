/**
 * Encryption of in-browser wallet secrets: AES-256-GCM with a PBKDF2-SHA256 derived key.
 * Nothing here touches the network; the ciphertext lives in localStorage only.
 */
const PBKDF2_ITERATIONS = 310_000;

export interface EncryptedBlob {
  v: 1;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 ciphertext
  iterations: number;
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("WebCrypto unavailable");
  return c.subtle;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(secret: Uint8Array, password: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, secret as BufferSource);
  return { v: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(new Uint8Array(ct)), iterations: PBKDF2_ITERATIONS };
}

export async function decryptSecret(blob: EncryptedBlob, password: string): Promise<Uint8Array> {
  const key = await deriveKey(password, fromB64(blob.salt), blob.iterations);
  try {
    const pt = await subtle().decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) as BufferSource }, key, fromB64(blob.data) as BufferSource);
    return new Uint8Array(pt);
  } catch {
    throw new Error("Mot de passe incorrect");
  }
}
