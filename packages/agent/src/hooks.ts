/**
 * Hook scoring: which spoken line should open the video?
 * Deterministic; used by the analysis worker (to fill analysis.hooks) and by the builder.
 */
import type { AssetAnalysis } from "@vibe/edl";

export type Hook = AssetAnalysis["hooks"][number];

const POWER_WORDS = [
  "mistake", "mistakes", "secret", "secrets", "never", "stop", "why", "how", "wrong", "truth", "nobody", "everyone", "biggest", "best", "worst",
  "hack", "free", "money", "instantly", "actually", "nothing", "everything", "warning", "proof", "crazy", "insane", "ruined", "changed",
  "before", "after", "finally", "problem", "fix", "fast", "easy", "simple", "hidden", "lie", "lies", "myth", "truth", "hate", "love",
];
const STRONG_VERBS = ["stop", "start", "quit", "lose", "win", "kill", "break", "build", "steal", "double", "triple", "fix", "cut", "save", "waste", "avoid", "forget", "imagine", "watch", "listen"];
const WEAK_OPENERS = /^(hey|hi|hello|so|um|uh|okay|ok|yeah|welcome|what's up|whats up|alright|thanks|thank you|today)\b/i;

export function scoreHookText(text: string, opts: { startMs?: number } = {}): number {
  const t = text.trim();
  if (!t) return 0;
  const words = t.split(/\s+/);
  const lower = t.toLowerCase();
  let score = 1;
  if (/\?\s*$/.test(t)) score += 2.2;
  if (/\d/.test(t)) score += 2;
  else if (/\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|half|double|triple)\b/i.test(lower)) score += 1.5;
  // List items ("the third mistake…", "number two is…") depend on context: weak openers.
  if (/^(?:and |so |ok(?:ay)? |then |now )?(?:the |my |our )?(?:first|second|third|fourth|fifth|next|another|last|final)(?:ly)?\b|\bnumber (?:one|two|three|four|five|\d+)\b|^(?:mistake|tip|step|reason|point|rule) (?:number )?\w+\b/i.test(lower)) score -= 2;
  if (/\b(you|your|you're|yours)\b/i.test(t)) score += 1.5;
  if (/\b(i|we)\b/i.test(t) && /\b(learned|lost|made|spent|tried|failed|quit)\b/i.test(t)) score += 1.2;
  let power = 0;
  for (const w of POWER_WORDS) if (new RegExp(`\\b${w}\\b`, "i").test(lower)) power += 1;
  score += Math.min(power, 3) * 1.4;
  if (STRONG_VERBS.some((v) => new RegExp(`^${v}\\b`, "i").test(lower))) score += 1.5;
  if (words.length >= 4 && words.length <= 14) score += 1.5;
  else if (words.length > 24) score -= 2;
  else if (words.length < 3) score -= 1.5;
  if (WEAK_OPENERS.test(t)) score -= 4;
  // Audience-wide claims make great cold opens; lines that lean on what came before do not.
  if (/^(most|every|nobody|no one|everyone|everybody|all)\b/i.test(t)) score += 1.5;
  if (/^(here'?s what|here is what|so that'?s|that'?s why|and that|which is why|this is why|now,? |but |because |and so)/i.test(t)) score -= 2;
  if (/\b(this video|in this video|today (we|i)|i want to show|let me show|i'?m going to (show|tell|share)|welcome back)\b/i.test(lower)) score -= 1.5;
  const fillers = (lower.match(/\b(um+|uh+|erm)\b/g) ?? []).length;
  score -= fillers * 1.2;
  if (opts.startMs !== undefined) {
    if (opts.startMs <= 60_000) score += 1;
    if (opts.startMs <= 10_000) score += 0.5;
  }
  return Math.round(score * 100) / 100;
}

/** Best 3 opening lines from the transcript segments (or the pre-computed hooks when the transcript is missing). */
export function pickHooks(analysis: AssetAnalysis): Hook[] {
  const segments = analysis.transcript?.segments ?? [];
  if (!segments.length) return [...(analysis.hooks ?? [])].sort((a, b) => b.score - a.score).slice(0, 3);
  const scored: Hook[] = [];
  for (const seg of segments) {
    const dur = seg.endMs - seg.startMs;
    if (dur < 900) continue;
    let score = scoreHookText(seg.text, { startMs: seg.startMs });
    if (dur > 8000) score -= (dur - 8000) / 4000; // too long to be a punchy opener
    if (dur >= 1500 && dur <= 6000) score += 0.8;
    scored.push({ startMs: seg.startMs, endMs: seg.endMs, text: seg.text.trim(), score: Math.round(score * 100) / 100 });
  }
  scored.sort((a, b) => b.score - a.score || a.startMs - b.startMs);
  return scored.slice(0, 3);
}
