import { NextResponse } from "next/server";
import { scanGithub } from "@/lib/larpcheck/scan";
import { GitHubError } from "@/lib/larpcheck/github";

export const runtime = "nodejs";

/**
 * GET /api/larpcheck?github=<url|owner/repo>&mint=&name=&symbol=
 * Returns a LarpReport. Errors: 400 bad input, 404 unknown repo, 429 GitHub rate limit.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const github = searchParams.get("github") ?? "";
  if (!github) return NextResponse.json({ error: "github param required" }, { status: 400 });
  try {
    const report = await scanGithub(github, {
      mint: searchParams.get("mint") ?? undefined,
      name: searchParams.get("name") ?? undefined,
      symbol: searchParams.get("symbol") ?? undefined,
    });
    return NextResponse.json(report, { headers: { "cache-control": "public, max-age=300" } });
  } catch (e) {
    const status = e instanceof GitHubError ? (e.status === 429 ? 429 : e.status === 404 ? 404 : 502) : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
