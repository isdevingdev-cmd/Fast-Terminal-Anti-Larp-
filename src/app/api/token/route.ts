import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { serverRpcUrl } from "@/lib/config";
import { METAPLEX_METADATA_PROGRAM_ID, normaliseOffchainMetadata, parseMetaplexMetadata } from "@/lib/pump/metadata";
import { fetchMetadataJson } from "@/lib/pump/ipfs";
import { isValidPublicKey } from "@/lib/base58";

export const runtime = "nodejs";

const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 10 * 60_000;

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
  let supply: string | null = null;
  let tokenProgram: string | null = null;
  {
    try {
      const conn = new Connection(serverRpcUrl(), "confirmed");
      const mintPk = new PublicKey(mint);
      // pump.fun mints with Token-2022 since 2025: name/symbol/uri live in the mint's TokenMetadata extension.
      const parsedMint = await conn.getParsedAccountInfo(mintPk);
      const data = parsedMint.value?.data;
      tokenProgram = parsedMint.value?.owner.toBase58() ?? null;
      const info =
        data && "parsed" in data
          ? (data.parsed as { info?: { supply?: string; extensions?: { extension: string; state?: Record<string, string> }[] } }).info
          : undefined;
      supply = info?.supply ?? null;
      const ext = (info?.extensions ?? []).find((e) => e.extension === "tokenMetadata");
      if (ext?.state) {
        name = ext.state.name ?? "";
        symbol = ext.state.symbol ?? "";
        uri = ext.state.uri ?? "";
      } else if (!uri) {
        // Older SPL-Token mints: Metaplex metadata PDA.
        const [pda] = PublicKey.findProgramAddressSync(
          [Buffer.from("metadata"), new PublicKey(METAPLEX_METADATA_PROGRAM_ID).toBuffer(), mintPk.toBuffer()],
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
      }
    } catch (e) {
      console.error("[api/token] rpc", e);
    }
  }

  const json = uri ? await fetchMetadataJson(uri) : null;
  const metadata = json ? normaliseOffchainMetadata(json) : null;
  const body = {
    mint,
    name: name || (json?.name as string | undefined) || "",
    symbol: symbol || (json?.symbol as string | undefined) || "",
    uri,
    metadata,
    supply,
    tokenProgram,
    /** Mayhem-mode coins mint 2B tokens (1B curve + 1B agent inventory). */
    mayhem: supply === "2000000000000000",
  };
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 5000) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 1000);
    for (const [k] of oldest) cache.delete(k);
  }
  return NextResponse.json(body);
}
