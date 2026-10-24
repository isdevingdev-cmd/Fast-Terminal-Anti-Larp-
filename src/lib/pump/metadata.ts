import type { TokenMetadata } from "./types";

export const METAPLEX_METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

/** Parse the on-chain Metaplex metadata account (only the fields we need). */
export function parseMetaplexMetadata(data: Uint8Array): { name: string; symbol: string; uri: string } | null {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let off = 1 + 32 + 32; // key, update authority, mint
    const readStr = () => {
      const len = view.getUint32(off, true);
      off += 4;
      const s = new TextDecoder().decode(data.subarray(off, off + len));
      off += len;
      return s.replace(/\0+$/g, "").trim();
    };
    const name = readStr();
    const symbol = readStr();
    const uri = readStr();
    return { name, symbol, uri };
  } catch {
    return null;
  }
}

const GITHUB_RE = /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?/gi;
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/gi;

export function ipfsToHttp(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

/** Normalise the off-chain JSON (pump.fun format + common extensions) into TokenMetadata. */
export function normaliseOffchainMetadata(json: Record<string, unknown>): TokenMetadata {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const ext = (json.extensions ?? {}) as Record<string, unknown>;
  const website = str(json.website) || str(ext.website) || str(json.external_url);
  const twitter = str(json.twitter) || str(ext.twitter);
  const telegram = str(json.telegram) || str(ext.telegram);
  const description = str(json.description);
  const image = ipfsToHttp(str(json.image));

  const haystack = JSON.stringify(json);
  const links = Array.from(new Set((haystack.match(URL_RE) ?? []).map((u) => u.replace(/\\$/, ""))));
  const ghMatches = haystack.match(GITHUB_RE) ?? [];
  const github = str(json.github) || str(ext.github) || ghMatches[0] || (website.includes("github.com") ? website : "");

  return { image, description, website, twitter, telegram, github: github || undefined, links };
}

export function extractGithub(md?: TokenMetadata | null): string | null {
  if (!md) return null;
  if (md.github) return md.github;
  for (const l of md.links) if (/github\.com\//i.test(l)) return l;
  return null;
}
