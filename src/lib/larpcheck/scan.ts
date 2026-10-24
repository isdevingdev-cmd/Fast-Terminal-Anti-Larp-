import { gatherFacts, GitHubError, parseGithubTarget } from "./github";
import { scoreFacts } from "./scoring";
import type { LarpReport } from "./types";

const cache = new Map<string, { at: number; report: LarpReport }>();
const TTL = 15 * 60_000;

export async function scanGithub(
  input: string,
  token?: { mint?: string; name?: string; symbol?: string },
): Promise<LarpReport> {
  const target = parseGithubTarget(input);
  if (!target) throw new GitHubError("lien GitHub invalide", 400);
  const key = `${target.owner}/${target.repo ?? "*"}|${token?.mint ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { ...hit.report, cached: true };

  const facts = await gatherFacts(target, token);
  const report = scoreFacts(facts);
  report.input = input;
  cache.set(key, { at: Date.now(), report });
  if (cache.size > 2000) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 500);
    for (const [k] of oldest) cache.delete(k);
  }
  return report;
}
