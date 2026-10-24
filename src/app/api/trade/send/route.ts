import { NextResponse } from "next/server";
import { JITO_URL } from "@/lib/config";

export const runtime = "nodejs";

/**
 * POST /api/trade/send  { txBase64 }
 * Forwards a SIGNED transaction to the Jito block engine (MEV-protected path).
 * Used because the block engine does not reliably answer browser CORS preflights.
 */
export async function POST(req: Request) {
  const { txBase64 } = (await req.json()) as { txBase64?: string };
  if (!txBase64) return NextResponse.json({ error: "missing tx" }, { status: 400 });
  const res = await fetch(JITO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [txBase64, { encoding: "base64" }] }),
  });
  const json = (await res.json().catch(() => ({}))) as { result?: string; error?: { message?: string } };
  if (!res.ok || json.error) {
    return NextResponse.json({ error: json.error?.message ?? `jito ${res.status}` }, { status: 502 });
  }
  return NextResponse.json({ signature: json.result });
}
