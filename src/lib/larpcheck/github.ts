/**
 * Thin GitHub REST client + fact gathering for LarpCheck. Server-side only
 * (uses GITHUB_TOKEN when present to lift the 60 req/h anonymous limit).
 */
import type { CommitFact, RepoFacts } from "./facts";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "fast-terminal-larpcheck",
    "x-github-api-version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

let tokenRejected = false;

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const h = { ...headers(), ...(init?.headers ?? {}) } as Record<string, string>;
  if (tokenRejected) delete h.authorization;
  let res = await fetch(`${API}${path}`, { ...init, headers: h });
  if (res.status === 401 && h.authorization) {
    // Invalid GITHUB_TOKEN: degrade to anonymous access instead of failing every scan.
    tokenRejected = true;
    delete h.authorization;
    res = await fetch(`${API}${path}`, { ...init, headers: h });
  }
  if (res.status === 404) throw new GitHubError("not found", 404);
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("x-ratelimit-reset");
    throw new GitHubError(`GitHub rate limit${reset ? ` (reset ${new Date(Number(reset) * 1000).toISOString()})` : ""}`, 429);
  }
  if (!res.ok) throw new GitHubError(`GitHub ${res.status}`, res.status);
  return (await res.json()) as T;
}

async function ghOptional<T>(path: string): Promise<T | null> {
  try {
    return await gh<T>(path);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    if (e instanceof GitHubError && e.status === 409) return null; // empty repo
    throw e;
  }
}

export interface ParsedTarget {
  owner: string;
  repo?: string;
}

/** Accepts "owner", "owner/repo", "github.com/owner/repo", "https://github.com/owner/repo/tree/x". */
export function parseGithubTarget(input: string): ParsedTarget | null {
  const s = input.trim().replace(/^@/, "");
  const m = s.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)(?:\/([A-Za-z0-9_.-]+))?/i);
  if (m) return { owner: m[1], repo: m[2]?.replace(/\.git$/, "") };
  const parts = s.split("/").filter(Boolean);
  if (parts.length === 1 && /^[A-Za-z0-9_.-]+$/.test(parts[0])) return { owner: parts[0] };
  if (parts.length === 2 && parts.every((p) => /^[A-Za-z0-9_.-]+$/.test(p))) return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  return null;
}

interface GhRepo {
  name: string;
  full_name: string;
  owner: { login: string; type: string };
  fork: boolean;
  parent?: { full_name: string };
  stargazers_count: number;
  forks_count: number;
  size: number;
  language: string | null;
  created_at: string;
  pushed_at: string;
  description: string | null;
  html_url: string;
  default_branch: string;
}
interface GhUser {
  login: string;
  type: string;
  created_at: string;
  public_repos: number;
  followers: number;
}
interface GhCommitListItem {
  sha: string;
  commit: { author: { date: string; email?: string } | null; message: string };
  author: { login: string } | null;
}
interface GhCommitDetail {
  sha: string;
  stats?: { additions: number; deletions: number };
  files?: unknown[];
}
interface GhContributor {
  login: string;
  contributions: number;
}
interface GhContent {
  name: string;
  type: string;
  download_url: string | null;
}

/** When only an owner is given, choose their most relevant repository. */
async function pickRepoForOwner(owner: string): Promise<string> {
  const repos = await gh<GhRepo[]>(`/users/${owner}/repos?sort=pushed&per_page=30&type=owner`);
  const own = repos.filter((r) => !r.fork);
  const pool = own.length ? own : repos;
  if (!pool.length) throw new GitHubError("aucun repo public", 404);
  pool.sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at) - Date.parse(a.pushed_at));
  return pool[0].name;
}

const MANIFEST_FILES = ["package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "Anchor.toml", "go.mod"];

export async function gatherFacts(target: ParsedTarget, token?: { mint?: string; name?: string; symbol?: string }): Promise<RepoFacts> {
  const repoName = target.repo ?? (await pickRepoForOwner(target.owner));
  const repo = await gh<GhRepo>(`/repos/${target.owner}/${repoName}`);
  const owner = repo.owner.login;

  const [user, languages, contributors, readmeRes, rootContents, commitPages] = await Promise.all([
    ghOptional<GhUser>(`/users/${owner}`),
    ghOptional<Record<string, number>>(`/repos/${owner}/${repo.name}/languages`),
    ghOptional<GhContributor[]>(`/repos/${owner}/${repo.name}/contributors?per_page=10`),
    fetch(`${API}/repos/${owner}/${repo.name}/readme`, { headers: { ...headers(), accept: "application/vnd.github.raw+json" } }).catch(() => null),
    ghOptional<GhContent[]>(`/repos/${owner}/${repo.name}/contents/`),
    Promise.all([1, 2, 3].map((p) => ghOptional<GhCommitListItem[]>(`/repos/${owner}/${repo.name}/commits?per_page=100&page=${p}`))),
  ]);

  const readme = readmeRes && readmeRes.ok ? (await readmeRes.text()).slice(0, 20_000) : "";
  const commitItems = commitPages.flatMap((p) => p ?? []);
  const commits: CommitFact[] = commitItems.map((c) => ({
    sha: c.sha,
    date: c.commit.author?.date ? Date.parse(c.commit.author.date) : 0,
    authorLogin: c.author?.login ?? null,
    authorEmail: c.commit.author?.email ?? null,
    message: c.commit.message ?? "",
  }));

  // Sample up to 8 commits (newest, oldest, spread) for diff stats.
  const sampleIdx = new Set<number>();
  const n = commits.length;
  if (n) {
    sampleIdx.add(0);
    sampleIdx.add(n - 1);
    for (let i = 1; i <= 6; i++) sampleIdx.add(Math.floor((n - 1) * (i / 7)));
  }
  await Promise.all(
    [...sampleIdx].map(async (i) => {
      const d = await ghOptional<GhCommitDetail>(`/repos/${owner}/${repo.name}/commits/${commits[i].sha}`);
      if (d?.stats) {
        commits[i].additions = d.stats.additions;
        commits[i].deletions = d.stats.deletions;
        commits[i].filesChanged = d.files?.length ?? 0;
      }
    }),
  );

  const rootFiles = (rootContents ?? []).map((c) => c.name);
  const manifests: Record<string, string> = {};
  await Promise.all(
    (rootContents ?? [])
      .filter((c) => c.type === "file" && MANIFEST_FILES.includes(c.name) && c.download_url)
      .map(async (c) => {
        try {
          const r = await fetch(c.download_url!, { headers: { "user-agent": "fast-terminal-larpcheck" } });
          if (r.ok) manifests[c.name] = (await r.text()).slice(0, 20_000);
        } catch {
          /* ignore */
        }
      }),
  );

  return {
    owner,
    name: repo.name,
    url: repo.html_url,
    isFork: repo.fork,
    parentFullName: repo.parent?.full_name ?? null,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    sizeKb: repo.size,
    language: repo.language,
    languages: languages ?? {},
    createdAt: Date.parse(repo.created_at),
    pushedAt: Date.parse(repo.pushed_at),
    description: repo.description ?? "",
    readme,
    rootFiles,
    manifests,
    commits,
    totalCommitsEstimate: contributors?.reduce((a, c) => a + c.contributions, 0) || commits.length,
    contributors: (contributors ?? []).map((c) => ({ login: c.login, commits: c.contributions })),
    ownerAccount: user
      ? { login: user.login, type: user.type, createdAt: Date.parse(user.created_at), publicRepos: user.public_repos, followers: user.followers }
      : null,
    tokenMint: token?.mint,
    tokenName: token?.name,
    tokenSymbol: token?.symbol,
  };
}
