import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFacts, weeklyBuckets } from "../src/lib/larpcheck/scoring";
import { parseGithubTarget } from "../src/lib/larpcheck/github";
import type { RepoFacts, CommitFact } from "../src/lib/larpcheck/facts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-24T12:00:00Z");

function commits(n: number, spanDays: number, opts: { regular?: boolean; big?: boolean } = {}): CommitFact[] {
  const out: CommitFact[] = [];
  let seed = 42;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const frac = opts.regular ? i / n : Math.pow(rnd(), 1.5);
    out.push({
      sha: `sha${i}`,
      date: NOW - frac * spanDays * DAY,
      authorLogin: "dev",
      authorEmail: null,
      message: opts.regular ? "update" : `feat: thing ${i} ${rnd().toString(36).slice(2, 6)}`,
      additions: opts.big ? 12000 : 40 + Math.floor(rnd() * 200),
      deletions: 10,
      filesChanged: opts.big ? 300 : 3,
    });
  }
  return out.sort((a, b) => b.date - a.date);
}

function base(over: Partial<RepoFacts> = {}): RepoFacts {
  return {
    owner: "builder",
    name: "agent",
    url: "https://github.com/builder/agent",
    isFork: false,
    parentFullName: null,
    stars: 40,
    forks: 3,
    sizeKb: 4000,
    language: "TypeScript",
    languages: { TypeScript: 100000 },
    createdAt: NOW - 240 * DAY,
    pushedAt: NOW - 1 * DAY,
    description: "An autonomous on-chain AI agent for Solana",
    readme: "# Agent\n".padEnd(600, "x") + " Uses OpenAI and @solana/web3.js to trade on-chain.",
    rootFiles: ["package.json", "src", "README.md"],
    manifests: { "package.json": JSON.stringify({ dependencies: { openai: "^4", "@solana/web3.js": "^1.98" } }) },
    commits: commits(220, 240),
    totalCommitsEstimate: 412,
    contributors: [
      { login: "builder", commits: 300 },
      { login: "mira", commits: 90 },
      { login: "x", commits: 22 },
    ],
    ownerAccount: { login: "builder", type: "User", createdAt: NOW - 6 * 365 * DAY, publicRepos: 24, followers: 180 },
    ...over,
  };
}

test("parses github targets", () => {
  assert.deepEqual(parseGithubTarget("https://github.com/foo/bar"), { owner: "foo", repo: "bar" });
  assert.deepEqual(parseGithubTarget("github.com/foo/bar.git/tree/main"), { owner: "foo", repo: "bar" });
  assert.equal(parseGithubTarget("foo")?.owner, "foo");
  assert.equal(parseGithubTarget("foo")?.repo, undefined);
  assert.deepEqual(parseGithubTarget("foo/bar"), { owner: "foo", repo: "bar" });
  assert.equal(parseGithubTarget("https://x.com/foo"), null);
});

test("a real builder scores S/A", () => {
  const r = scoreFacts(base(), NOW);
  assert.ok(r.score >= 8, `score ${r.score} ${JSON.stringify(r.checks.map((c) => [c.id, c.score, c.detail]))}`);
  assert.ok(["S", "A"].includes(r.tier));
  assert.equal(r.weeklyCommits.length, 36);
});

test("a renamed fork with a code dump from a 3-day-old account scores D/F", () => {
  const r = scoreFacts(
    base({
      isFork: true,
      parentFullName: "elizaOS/eliza",
      createdAt: NOW - 3 * DAY,
      pushedAt: NOW - 0.1 * DAY,
      commits: commits(3, 2, { big: true }),
      contributors: [{ login: "newdev", commits: 3 }],
      totalCommitsEstimate: 3,
      manifests: {},
      rootFiles: ["README.md"],
      languages: {},
      ownerAccount: { login: "newdev", type: "User", createdAt: NOW - 3 * DAY, publicRepos: 1, followers: 0 },
    }),
    NOW,
  );
  assert.ok(r.score < 3, `score ${r.score} ${JSON.stringify(r.checks.map((c) => [c.id, c.score, c.detail]))}`);
  assert.ok(["D", "F"].includes(r.tier));
});

test("bot-paced commits are flagged", () => {
  const r = scoreFacts(base({ commits: commits(120, 60, { regular: true }) }), NOW);
  const timing = r.checks.find((c) => c.id === "commit_timing")!;
  assert.ok(timing.score < 0.7, timing.detail);
  const auth = r.checks.find((c) => c.id === "code_authenticity")!;
  assert.ok(auth.detail.includes("répétitifs"));
});

test("AI claim without evidence fails claims check", () => {
  const r = scoreFacts(base({ manifests: { "package.json": JSON.stringify({ dependencies: { express: "4" } }) }, readme: "# AI agent\n".padEnd(400, "y") }), NOW);
  const c = r.checks.find((c) => c.id === "claims_vs_evidence")!;
  assert.ok(c.score < 0.7, c.detail);
});

test("weekly buckets place recent commits last", () => {
  const b = weeklyBuckets([{ sha: "a", date: NOW - DAY, authorLogin: null, authorEmail: null, message: "" }], 36, NOW);
  assert.equal(b[35], 1);
  assert.equal(b.reduce((a, n) => a + n, 0), 1);
});
