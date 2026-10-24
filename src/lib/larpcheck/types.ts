export type LarpTier = "S" | "A" | "B" | "C" | "D" | "F";

export const TIER_LABELS: Record<LarpTier, string> = {
  S: "Satoshi-tier Builder",
  A: "Verified Builder",
  B: "Unverified But Trying",
  C: "Suspicious Activity",
  D: "Probable LARP",
  F: "Full LARP",
};

export const TIER_ORDER: LarpTier[] = ["S", "A", "B", "C", "D", "F"];

export function tierFromScore(score: number): LarpTier {
  if (score >= 9) return "S";
  if (score >= 7) return "A";
  if (score >= 5) return "B";
  if (score >= 3) return "C";
  if (score >= 1.5) return "D";
  return "F";
}

/** true when `a` is at least as good as `b` */
export function tierAtLeast(a: LarpTier, b: LarpTier): boolean {
  return TIER_ORDER.indexOf(a) <= TIER_ORDER.indexOf(b);
}

export type CheckStatus = "pass" | "warn" | "fail" | "na";

export interface LarpCheckItem {
  id:
    | "code_authenticity"
    | "commit_timing"
    | "developer_identity"
    | "activity_consistency"
    | "claims_vs_evidence"
    | "contract_alignment";
  label: string;
  status: CheckStatus;
  /** 0..1 contribution before weighting */
  score: number;
  detail: string;
}

export interface LarpReport {
  input: string;
  repo: { owner: string; name: string; url: string; isFork: boolean; stars: number; language: string | null } | null;
  owner: { login: string; type: string; createdAt: string; publicRepos: number; followers: number } | null;
  score: number; // 0..10
  tier: LarpTier;
  verdict: string;
  summary: string;
  checks: LarpCheckItem[];
  /** last 36 weeks of commit counts (oldest first) */
  weeklyCommits: number[];
  contributors: { login: string; commits: number; share: number }[];
  scannedAt: number;
  cached?: boolean;
  error?: string;
}
