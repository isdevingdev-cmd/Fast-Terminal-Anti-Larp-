import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "@/lib/config";
import { ipfsToHttp, METAPLEX_METADATA_PROGRAM_ID, normaliseOffchainMetadata, parseMetaplexMetadata } from "@/lib/pump/metadata";
import { isValidPublicKey } from "@/lib/base58";

export const runtime = "nodejs";

const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 10 * 60_000;

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" }, next: { revalidate: 600 } });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * GET /api/token?mint=<mint>&uri=<optional metadata uri>
 * Resolves on-chain identity (when `uri` is unknown) and the off-chain JSON,
 * returning a normalised TokenMetadata payload with every link found (for LarpCheck).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get("mint") ?? "";
  let uri = searchParams.get("uri") ?? "";
  if (!mint || !isValidPublicKey(mint)) return NextResponse.json({ error: "invalid mint" }, { status: 400 });

  const key = `${mint}|${uri}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body, { headers: { "x-cache": "hit" } });

  let name = "";
  let symbol = "";
  if (!uri) {
    try {
      const conn = new Connection(RPC_URL, "confirmed");
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), new PublicKey(METAPLEX_METADATA_PROGRAM_ID).toBuffer(), new PublicKey(mint).toBuffer()],
        new PublicKey(METAPLEX_METADATA_PROGRAM_ID),
      );
      const acc = await conn.getAccountInfo(pda);
      if (acc) {
        const parsed = parseMetaplexMetadata(new Uint8Array(acc.data));
        if (parsed) {
          name = parsed.name;
          symbol = parsed.symbol;
          uri = parsed.uri;
        }
      }
    } catch (e) {
      console.error("[api/token] rpc", e);
    }
  }

  const json = uri ? await fetchJson(ipfsToHttp(uri)) : null;
  const metadata = json ? normaliseOffchainMetadata(json) : null;
  const body = {
    mint,
    name: name || (json?.name as string | undefined) || "",
    symbol: symbol || (json?.symbol as string | undefined) || "",
    uri,
    metadata,
  };
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 5000) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 1000);
    for (const [k] of oldest) cache.delete(k);
  }
  return NextResponse.json(body);
}
