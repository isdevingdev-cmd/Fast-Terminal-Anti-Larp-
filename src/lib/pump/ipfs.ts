/**
 * IPFS access that survives the public gateways' rate limits.
 * ipfs.io / dweb.link / w3s.link answer 429 to servers since 2026; pump.fun pins on Pinata
 * (pump.mypinata.cloud, 403 for content it does not pin) and Filebase answers quickly for anything.
 */
const CID_RE = /(?:ipfs:\/\/|\/ipfs\/)([A-Za-z0-9]{46,}|bafy[a-z2-7]{20,}|bafk[a-z2-7]{20,})(\/[^?#]*)?/i;

export function extractCid(url: string): { cid: string; path: string } | null {
  const m = url.match(CID_RE);
  if (!m) return null;
  return { cid: m[1], path: m[2] ?? "" };
}

/** Ordered gateway candidates for a CID (JSON or image). */
export function gatewayUrls(cid: string, path = "", opts: { image?: boolean } = {}): string[] {
  const p = path || "";
  const img = opts.image ? "?img-width=128&img-dpr=2&img-onerror=redirect" : "";
  return [
    `https://pump.mypinata.cloud/ipfs/${cid}${p}${img}`,
    `https://ipfs.filebase.io/ipfs/${cid}${p}`,
    `https://gateway.pinata.cloud/ipfs/${cid}${p}`,
    `https://ipfs.io/ipfs/${cid}${p}`,
  ];
}

/** Candidate URLs for an image field: IPFS gateways when it is IPFS content, else the URL itself. */
export function imageCandidates(url: string | undefined): string[] {
  if (!url) return [];
  const c = extractCid(url);
  if (!c) return [url];
  const list = gatewayUrls(c.cid, c.path, { image: true });
  return url.startsWith("http") && !list.includes(url) ? [...list, url] : list;
}

async function fetchJsonOnce(url: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" }, redirect: "follow" });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch an off-chain metadata document. IPFS content is raced across gateways
 * (first valid JSON wins); other URLs are fetched directly.
 */
export async function fetchMetadataJson(uri: string, timeoutMs = 7000): Promise<Record<string, unknown> | null> {
  const c = extractCid(uri);
  if (!c) return fetchJsonOnce(uri, timeoutMs);
  const urls = gatewayUrls(c.cid, c.path);
  // Fast gateways first in parallel, slow ones as a fallback.
  const fast = urls.slice(0, 2).map((u) => fetchJsonOnce(u, timeoutMs));
  const first = await Promise.any(fast.map((p) => p.then((v) => (v ? v : Promise.reject(new Error("miss")))))).catch(() => null);
  if (first) return first;
  for (const u of urls.slice(2)) {
    const v = await fetchJsonOnce(u, timeoutMs);
    if (v) return v;
  }
  return null;
}
