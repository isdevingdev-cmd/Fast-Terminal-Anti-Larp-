import { NextResponse } from "next/server";

export const runtime = "nodejs";

let cached: { at: number; usd: number } | null = null;

/** GET /api/solprice → { usd } (cached 20 s). */
export async function GET() {
  if (cached && Date.now() - cached.at < 20_000) return NextResponse.json({ usd: cached.usd, cached: true });
  const sources: (() => Promise<number>)[] = [
    async () => {
      const r = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112", { cache: "no-store" });
      const j = (await r.json()) as { data: Record<string, { price: string }> };
      return Number(j.data["So11111111111111111111111111111111111111112"].price);
    },
    async () => {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { cache: "no-store" });
      const j = (await r.json()) as { solana: { usd: number } };
      return j.solana.usd;
    },
  ];
  for (const s of sources) {
    try {
      const usd = await s();
      if (Number.isFinite(usd) && usd > 0) {
        cached = { at: Date.now(), usd };
        return NextResponse.json({ usd });
      }
    } catch {
      /* try next */
    }
  }
  return NextResponse.json({ usd: cached?.usd ?? 0, stale: true }, { status: cached ? 200 : 503 });
}
