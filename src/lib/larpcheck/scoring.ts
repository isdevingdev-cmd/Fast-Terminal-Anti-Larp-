/**
 * LarpCheck scoring — six checks, each 0..1, weighted into a 0..10 score and an S–F tier.
 * Pure function: no I/O, fully unit-testable.
 *
 * The goal is not to prove a developer is good, but to catch the classic LARP patterns:
 * renamed forks, one-shot code dumps before launch, bot-paced commits, brand-new accounts,
 * READMEs that promise "AI agents" with no model/SDK anywhere in the code, and claimed
 * on-chain programs with no program source.
 */
import type { CommitFact, RepoFacts } from "./facts";
import { TIER_LABELS, tierFromScore, type CheckStatus, type LarpCheckItem, type LarpReport } from "./types";

const DAY = 86_400_000;

const WEIGHTS: Record<LarpCheckItem["id"], number> = {
  code_authenticity: 2.2,
  commit_timing: 1.6,
  developer_identity: 1.8,
  activity_consistency: 1.8,
  claims_vs_evidence: 1.6,
  contract_alignment: 1.0,
};

function status(score: number): CheckStatus {
  if (score >= 0.7) return "pass";
  if (score >= 0.4) return "warn";
  return "fail";
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stddev(xs: number[]) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

// ---------------------------------------------------------------------------
// 1. Code authenticity
// ---------------------------------------------------------------------------
export function checkCodeAuthenticity(f: RepoFacts): LarpCheckItem {
  const notes: string[] = [];
  let score = 1;

  if (f.isFork) {
    score -= 0.5;
    notes.push(`fork de ${f.parentFullName ?? "un autre repo"}`);
  }
  const sampled = f.commits.filter((c) => c.filesChanged !== undefined);
  if (sampled.length) {
    const huge = sampled.filter((c) => (c.additions ?? 0) > 5000);
    const total = f.commits.length;
    // one or two giant commits and almost nothing else = code dump / copy-paste
    if (total <= 5 && huge.length >= 1) {
      score -= 0.45;
      notes.push("dump de code en 1–5 commits");
    } else if (huge.length / sampled.length > 0.5) {
      score -= 0.2;
      notes.push("majorité de commits géants");
    }
    const empties = sampled.filter((c) => (c.additions ?? 0) + (c.deletions ?? 0) === 0);
    if (empties.length / sampled.length > 0.5) {
      score -= 0.3;
      notes.push("commits sans diff");
    }
  }
  const msgs = f.commits.map((c) => c.message.trim().toLowerCase());
  const uniq = new Set(msgs).size;
  if (msgs.length >= 10 && uniq / msgs.length < 0.3) {
    score -= 0.25;
    notes.push("messages de commit répétitifs");
  }
  if (f.sizeKb < 20 && !f.isFork && Object.keys(f.languages).length === 0) {
    score -= 0.4;
    notes.push("repo quasi vide");
  }
  score = clamp01(score);
  const detail = notes.length ? notes.join(" · ") : f.isFork ? "fork déclaré" : "vrais diffs, code original";
  return { id: "code_authenticity", label: "Code authentique", status: status(score), score, detail };
}

// ---------------------------------------------------------------------------
// 2. Commit timing
// ---------------------------------------------------------------------------
export function checkCommitTiming(f: RepoFacts, now = Date.now()): LarpCheckItem {
  const dates = f.commits.map((c) => c.date).sort((a, b) => a - b);
  if (dates.length < 5) {
    return {
      id: "commit_timing",
      label: "Timing des commits",
      status: "warn",
      score: 0.3,
      detail: `${dates.length} commit(s) seulement`,
    };
  }
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1]);
  const cv = mean(gaps) > 0 ? stddev(gaps) / mean(gaps) : 0; // coefficient of variation
  const notes: string[] = [];
  let score = 1;
  // Humans are bursty (cv ≳ 1). Scripted pushes are eerily regular (cv < 0.3).
  if (cv < 0.3 && gaps.length >= 8) {
    score -= 0.5;
    notes.push(`cadence mécanique (CV ${cv.toFixed(2)})`);
  }
  // Burst: share of commits in the last 7 days vs repo lifetime
  const ageDays = Math.max(1, (now - f.createdAt) / DAY);
  const last7 = dates.filter((d) => now - d < 7 * DAY).length;
  const share7 = last7 / dates.length;
  if (ageDays > 30 && share7 > 0.6) {
    score -= 0.35;
    notes.push(`${Math.round(share7 * 100)} % des commits sur 7 jours`);
  } else if (ageDays <= 7 && dates.length > 20) {
    score -= 0.25;
    notes.push("repo créé cette semaine, déjà très actif");
  }
  // Many commits within the same minute (bulk script)
  const sameMinute = gaps.filter((g) => g < 60_000).length / gaps.length;
  if (sameMinute > 0.5) {
    score -= 0.3;
    notes.push("rafales de commits < 1 min");
  }
  score = clamp01(score);
  return {
    id: "commit_timing",
    label: "Timing des commits",
    status: status(score),
    score,
    detail: notes.length ? notes.join(" · ") : `organique (CV ${cv.toFixed(2)})`,
  };
}

// ---------------------------------------------------------------------------
// 3. Developer identity
// ---------------------------------------------------------------------------
export function checkDeveloperIdentity(f: RepoFacts, now = Date.now()): LarpCheckItem {
  const o = f.ownerAccount;
  if (!o) {
    return { id: "developer_identity", label: "Identité dev", status: "warn", score: 0.3, detail: "compte introuvable" };
  }
  const ageDays = (now - o.createdAt) / DAY;
  let score = 0;
  // age: 0 at <14d, 1 at >= 2 years
  score += clamp01((ageDays - 14) / (730 - 14)) * 0.5;
  score += clamp01(o.publicRepos / 10) * 0.25;
  score += clamp01(Math.log10(o.followers + 1) / 2) * 0.25; // 100 followers → full
  const multi = f.contributors.filter((c) => c.commits >= 3).length;
  if (multi >= 2) score = clamp01(score + 0.1);
  const ageTxt = ageDays >= 365 ? `${(ageDays / 365).toFixed(1)} ans` : `${Math.round(ageDays)} j`;
  const detail = `compte ${ageTxt} · ${o.publicRepos} repos · ${o.followers} followers${multi >= 2 ? ` · ${multi} contributeurs actifs` : ""}`;
  return { id: "developer_identity", label: "Identité dev", status: status(score), score, detail };
}

// ---------------------------------------------------------------------------
// 4. Activity consistency
// ---------------------------------------------------------------------------
export function weeklyBuckets(commits: CommitFact[], weeks = 36, now = Date.now()): number[] {
  const out = new Array<number>(weeks).fill(0);
  const WEEK = 7 * DAY;
  for (const c of commits) {
    const idx = weeks - 1 - Math.floor((now - c.date) / WEEK);
    if (idx >= 0 && idx < weeks) out[idx] += 1;
  }
  return out;
}

export function checkActivityConsistency(f: RepoFacts, now = Date.now()): LarpCheckItem {
  const buckets = weeklyBuckets(f.commits, 36, now);
  const activeWeeks = buckets.filter((n) => n > 0).length;
  const ageWeeks = Math.max(1, Math.min(36, (now - f.createdAt) / (7 * DAY)));
  const ratio = activeWeeks / ageWeeks;
  const lastPushDays = (now - f.pushedAt) / DAY;
  let score = clamp01(ratio) * 0.6 + clamp01(activeWeeks / 12) * 0.4;
  const notes: string[] = [];
  if (lastPushDays > 60) {
    score *= 0.6;
    notes.push(`silence depuis ${Math.round(lastPushDays)} j`);
  }
  if (ageWeeks < 1) {
    score = Math.min(score, 0.3);
    notes.push("historique < 1 semaine");
  } else if (ageWeeks < 2) {
    score = Math.min(score, 0.45);
    notes.push("historique < 2 semaines");
  }
  notes.unshift(`${activeWeeks} semaines actives sur ${Math.round(ageWeeks)}`);
  return { id: "activity_consistency", label: "Activité régulière", status: status(score), score: clamp01(score), detail: notes.join(" · ") };
}

// ---------------------------------------------------------------------------
// 5. Claims vs evidence
// ---------------------------------------------------------------------------
const AI_CLAIMS = /\b(ai|a\.i\.|artificial intelligence|agent|agentic|llm|gpt|neural|machine learning|autonomous)\b/i;
const AI_EVIDENCE =
  /(openai|anthropic|@anthropic-ai|langchain|llamaindex|transformers|torch|tensorflow|ollama|gemini|mistral|groq|cohere|replicate|huggingface|vercel\/ai|"ai":|eliza|elizaos|crewai|autogen)/i;
const CHAIN_CLAIMS = /\b(on-?chain|solana|smart contract|program|dapp|defi|token|bonding curve|swap)\b/i;
const CHAIN_EVIDENCE = /(@solana\/web3\.js|@solana\/kit|@coral-xyz\/anchor|anchor-lang|solana-program|solana_sdk|solders|ethers|viem|wagmi|web3)/i;

export function checkClaimsVsEvidence(f: RepoFacts): LarpCheckItem {
  const text = `${f.description}\n${f.readme}`;
  const manifest = Object.values(f.manifests).join("\n");
  const langs = Object.keys(f.languages).join(",");
  const haystack = `${manifest}\n${langs}\n${f.rootFiles.join("\n")}`;
  const notes: string[] = [];
  let claims = 0;
  let backed = 0;

  if (AI_CLAIMS.test(text)) {
    claims++;
    if (AI_EVIDENCE.test(haystack)) {
      backed++;
      notes.push("claim IA étayé (SDK/modèle présent)");
    } else notes.push("claim IA sans SDK ni modèle dans le code");
  }
  if (CHAIN_CLAIMS.test(text)) {
    claims++;
    if (CHAIN_EVIDENCE.test(haystack) || /rust|move/i.test(langs)) {
      backed++;
      notes.push("claim on-chain étayé");
    } else notes.push("claim on-chain sans dépendance blockchain");
  }
  if (f.readme.trim().length < 200) notes.push("README quasi vide");

  let score: number;
  if (claims === 0) score = f.readme.length > 200 ? 0.75 : 0.5; // nothing claimed, nothing to disprove
  else score = backed / claims;
  if (f.readme.trim().length < 200) score = Math.min(score, 0.5);
  return {
    id: "claims_vs_evidence",
    label: "Claims vs preuves",
    status: claims === 0 ? "warn" : status(score),
    score: clamp01(score),
    detail: notes.length ? notes.join(" · ") : "README cohérent avec le code",
  };
}

// ---------------------------------------------------------------------------
// 6. Contract alignment
// ---------------------------------------------------------------------------
export function checkContractAlignment(f: RepoFacts): LarpCheckItem {
  const text = `${f.description}\n${f.readme}`;
  const claimsProgram = /\b(smart contract|on-?chain program|anchor|custom program|our contract|audited)\b/i.test(text);
  const hasProgramSource =
    f.rootFiles.some((n) => /^(anchor\.toml|cargo\.toml|programs?)$/i.test(n)) ||
    /solana-program|anchor-lang/i.test(Object.values(f.manifests).join("\n")) ||
    "Rust" in f.languages;
  const mentionsToken =
    !!f.tokenMint && (text.includes(f.tokenMint) || (f.tokenSymbol ? new RegExp(`\\$?${f.tokenSymbol}\\b`, "i").test(text) : false));
  const mentionsPump = /pump\.fun|pumpfun|pumpportal/i.test(text);

  const notes: string[] = [];
  let score = 0.6; // neutral baseline: most memecoins have no program at all, which is honest
  if (claimsProgram && hasProgramSource) {
    score = 1;
    notes.push("programme on-chain présent dans le repo");
  } else if (claimsProgram && !hasProgramSource) {
    score = 0.15;
    notes.push("programme revendiqué, aucun code de programme");
  } else if (!claimsProgram && hasProgramSource) {
    score = 0.9;
    notes.push("code de programme présent");
  } else notes.push("pas de programme revendiqué (token pump.fun standard)");
  if (mentionsToken) {
    score = clamp01(score + 0.1);
    notes.push("le repo référence le token");
  } else if (f.tokenMint) notes.push("le repo ne mentionne pas le token");
  if (mentionsPump) notes.push("mentionne pump.fun");

  return {
    id: "contract_alignment",
    label: "Contrat aligné",
    status: claimsProgram || mentionsToken ? status(score) : "na",
    score,
    detail: notes.join(" · "),
  };
}

// ---------------------------------------------------------------------------
export function scoreFacts(f: RepoFacts, now = Date.now()): LarpReport {
  const checks: LarpCheckItem[] = [
    checkCodeAuthenticity(f),
    checkCommitTiming(f, now),
    checkDeveloperIdentity(f, now),
    checkActivityConsistency(f, now),
    checkClaimsVsEvidence(f),
    checkContractAlignment(f),
  ];
  let weighted = 0;
  let totalW = 0;
  for (const c of checks) {
    const w = c.status === "na" ? WEIGHTS[c.id] * 0.5 : WEIGHTS[c.id];
    weighted += c.score * w;
    totalW += w;
  }
  let score = (weighted / totalW) * 10;
  // Hard caps: a renamed fork or an account younger than a week cannot reach S/A.
  if (f.isFork) score = Math.min(score, 6.9);
  if (f.ownerAccount && now - f.ownerAccount.createdAt < 7 * DAY) score = Math.min(score, 4.9);
  score = Math.round(score * 10) / 10;
  const tier = tierFromScore(score);

  const totalCommits = f.totalCommitsEstimate || f.commits.length;
  const contributorsTotal = f.contributors.reduce((a, c) => a + c.commits, 0) || 1;
  const contributors = f.contributors
    .slice(0, 5)
    .map((c) => ({ login: c.login, commits: c.commits, share: c.commits / contributorsTotal }));
  const ageDays = f.ownerAccount ? Math.round((now - f.ownerAccount.createdAt) / DAY) : null;
  const summary = [
    `${f.owner}/${f.name}`,
    `${f.contributors.length} contributeur${f.contributors.length > 1 ? "s" : ""}`,
    ageDays !== null ? `compte de ${ageDays >= 365 ? `${(ageDays / 365).toFixed(1)} ans` : `${ageDays} j`}` : null,
    `${totalCommits} commits`,
    f.isFork ? `fork de ${f.parentFullName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    input: f.url,
    repo: { owner: f.owner, name: f.name, url: f.url, isFork: f.isFork, stars: f.stars, language: f.language },
    owner: f.ownerAccount
      ? {
          login: f.ownerAccount.login,
          type: f.ownerAccount.type,
          createdAt: new Date(f.ownerAccount.createdAt).toISOString(),
          publicRepos: f.ownerAccount.publicRepos,
          followers: f.ownerAccount.followers,
        }
      : null,
    score,
    tier,
    verdict: TIER_LABELS[tier],
    summary,
    checks,
    weeklyCommits: weeklyBuckets(f.commits, 36, now),
    contributors,
    scannedAt: now,
  };
}
