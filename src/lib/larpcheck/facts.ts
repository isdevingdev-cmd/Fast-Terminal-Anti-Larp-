/** Normalised facts about a repository, independent of the GitHub API shape. */
export interface CommitFact {
  sha: string;
  /** ms epoch */
  date: number;
  authorLogin: string | null;
  authorEmail: string | null;
  message: string;
  /** present only on sampled commits */
  additions?: number;
  deletions?: number;
  filesChanged?: number;
}

export interface RepoFacts {
  owner: string;
  name: string;
  url: string;
  isFork: boolean;
  parentFullName: string | null;
  stars: number;
  forks: number;
  sizeKb: number;
  language: string | null;
  languages: Record<string, number>; // bytes
  createdAt: number;
  pushedAt: number;
  description: string;
  readme: string;
  /** names of files at repo root */
  rootFiles: string[];
  /** contents of manifest files we could read (package.json, requirements.txt, Cargo.toml, Anchor.toml...) */
  manifests: Record<string, string>;
  commits: CommitFact[]; // newest first, up to ~300
  totalCommitsEstimate: number;
  contributors: { login: string; commits: number }[];
  ownerAccount: {
    login: string;
    type: string;
    createdAt: number;
    publicRepos: number;
    followers: number;
  } | null;
  /** token context (optional) */
  tokenMint?: string;
  tokenName?: string;
  tokenSymbol?: string;
}
