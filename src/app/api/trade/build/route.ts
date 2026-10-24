import { NextResponse } from "next/server";
import { isValidPublicKey } from "@/lib/base58";

export const runtime = "nodejs";

const PUMPPORTAL_LOCAL = "https://pumpportal.fun/api/trade-local";

interface BuildBody {
  publicKey: string;
  action: "buy" | "sell";
  mint: string;
  amount: number | string;
  denominatedInSol: boolean;
  slippage: number;
  priorityFee: number;
  pool?: string;
}

/**
 * POST /api/trade/build
 * Proxies PumpPortal's Local Transaction API (returns an UNSIGNED transaction).
 * The user signs in the browser; the server never sees a private key.
 */
export async function POST(req: Request) {
  let body: BuildBody;
  try {
    body = (await req.json()) as BuildBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!isValidPublicKey(body.publicKey) || !isValidPublicKey(body.mint)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }
  if (body.action !== "buy" && body.action !== "sell") return NextResponse.json({ error: "bad action" }, { status: 400 });

  const res = await fetch(PUMPPORTAL_LOCAL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      publicKey: body.publicKey,
      action: body.action,
      mint: body.mint,
      amount: body.amount,
      denominatedInSol: body.denominatedInSol ? "true" : "false",
      slippage: body.slippage,
      priorityFee: body.priorityFee,
      pool: body.pool ?? "pump",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: `pumpportal ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return NextResponse.json({ txBase64: Buffer.from(bytes).toString("base64") });
}
