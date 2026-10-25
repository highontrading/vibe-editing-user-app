/**
 * Footage manifest: a compact text rendering of everything the model needs to
 * know about the uploaded assets. Budgeted (~25k tokens by default) and
 * downsampled smartly: long transcripts keep their segment boundaries but lose
 * words from the middle of each segment first.
 */
import type { AssetAnalysis } from "@vibe/edl";
import type { AgentAsset, ProjectContext } from "./types";
import { pickHooks } from "./hooks";

export const MANIFEST_TOKEN_BUDGET = 25_000;

export function fmtSec(ms: number): string {
  return (ms / 1000).toFixed(1);
}
export function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.6);
}

export function buildManifest(ctx: ProjectContext, opts: { budgetTokens?: number } = {}): string {
  const budget = opts.budgetTokens ?? MANIFEST_TOKEN_BUDGET;
  const assets = ctx.assets.filter((a) => a.ref);
  if (!assets.length) return "FOOTAGE: no assets uploaded yet.";
  // Share the budget between assets by duration; always leave room for the fixed parts.
  const totalDur = assets.reduce((n, a) => n + (a.analysis?.durationMs ?? a.ref.durationMs ?? 0), 0) || 1;
  const parts: string[] = [`FOOTAGE (${assets.length} asset${assets.length === 1 ? "" : "s"}, ${fmtSec(totalDur)}s total). Times are source seconds.`];
  for (const a of assets) {
    const share = Math.max(1500, Math.floor((budget - 800) * ((a.analysis?.durationMs ?? a.ref.durationMs ?? 1) / totalDur)));
    parts.push(renderAsset(a, share));
  }
  if (ctx.reference?.analysis) {
    parts.push("REFERENCE VIDEO (style to imitate, not footage to use):");
    parts.push(renderAsset(ctx.reference, 1500, true));
  }
  return parts.join("\n\n");
}

export function renderAsset(a: AgentAsset, budgetTokens: number, brief = false): string {
  const ref = a.ref;
  const an = a.analysis;
  const lines: string[] = [];
  const dur = an?.durationMs ?? ref.durationMs ?? 0;
  const size = an?.width && an?.height ? `${an.width}x${an.height}` : ref.width && ref.height ? `${ref.width}x${ref.height}` : "unknown size";
  lines.push(`ASSET ${ref.id} "${ref.name ?? ref.id}" ${ref.kind} ${fmtSec(dur)}s ${size}${an?.fps ? ` ${Math.round(an.fps)}fps` : ""}${an && !an.hasAudio ? " (no audio)" : ""}${an?.language ? ` lang=${an.language}` : ""}`);
  if (!an) {
    lines.push("  (not analysed)");
    return lines.join("\n");
  }
  if (an.summary) lines.push(`  summary: ${an.summary}`);
  if (an.shots.length) {
    const shots = brief ? an.shots.slice(0, 6) : an.shots.slice(0, 40);
    lines.push(`  shots (${an.shots.length}): ` + shots.map((s) => `[${fmtSec(s.startMs)}-${fmtSec(s.endMs)}${s.description ? ` ${s.description}` : ""}${s.tags.length ? ` #${s.tags.slice(0, 4).join(",")}` : ""}${s.subjectX !== undefined ? ` subj=${s.subjectX.toFixed(2)},${(s.subjectY ?? 0.5).toFixed(2)}` : ""}]`).join(" "));
    if (an.shots.length > shots.length) lines.push(`  … ${an.shots.length - shots.length} more shots`);
  }
  const sil = an.audio?.silences ?? [];
  if (sil.length) {
    const long = sil.filter((s) => s.endMs - s.startMs >= 400);
    lines.push(`  silences >=0.4s (${long.length} of ${sil.length}): ` + long.slice(0, 60).map((s) => `${fmtSec(s.startMs)}-${fmtSec(s.endMs)}`).join(" "));
  }
  const fillers = an.quality?.fillers ?? [];
  if (fillers.length) lines.push(`  fillers (${fillers.length}): ` + fillers.slice(0, 60).map((f) => `${fmtSec(f.startMs)} "${f.text}"`).join(" "));
  if (an.quality?.shaky?.length) lines.push(`  shaky: ` + an.quality.shaky.map((s) => `${fmtSec(s.startMs)}-${fmtSec(s.endMs)}`).join(" "));
  if (an.quality?.dark?.length) lines.push(`  dark: ` + an.quality.dark.map((s) => `${fmtSec(s.startMs)}-${fmtSec(s.endMs)}`).join(" "));
  if (an.audio?.hasMusic) lines.push("  audio: footage already contains music");
  const hooks = an.hooks.length ? an.hooks : pickHooks(an);
  if (hooks.length) lines.push(`  hook candidates: ` + hooks.slice(0, 3).map((h) => `[${fmtSec(h.startMs)}-${fmtSec(h.endMs)} score ${h.score.toFixed(1)}] "${h.text}"`).join(" "));
  if (an.transcript?.segments.length) {
    const header = lines.join("\n");
    const remaining = Math.max(600, budgetTokens - estimateTokens(header));
    lines.push(`  transcript (${an.transcript.segments.length} segments${an.transcript.speakers.length > 1 ? `, speakers ${an.transcript.speakers.join("/")}` : ""}):`);
    lines.push(renderTranscript(an, brief ? Math.min(remaining, 400) : remaining));
  } else if (an.transcript?.text) {
    lines.push(`  transcript: ${an.transcript.text.slice(0, 2000)}`);
  } else {
    lines.push("  no speech detected");
  }
  return lines.join("\n");
}

/** Render segments within a token budget: keep every boundary, shorten the text of long segments from the middle. */
export function renderTranscript(an: AssetAnalysis, budgetTokens: number): string {
  const segs = an.transcript?.segments ?? [];
  const full = segs.map((s) => segLine(s, s.text));
  if (estimateTokens(full.join("\n")) <= budgetTokens) return full.join("\n");
  // Pass 1: cap each segment at N words, decreasing N until it fits.
  for (const cap of [40, 30, 20, 14, 10, 7, 5]) {
    const lines = segs.map((s) => segLine(s, middleEllipsis(s.text, cap)));
    if (estimateTokens(lines.join("\n")) <= budgetTokens) return lines.join("\n");
  }
  // Pass 2: merge adjacent segments into ~20 s blocks keeping the first words of each.
  const blocks: { startMs: number; endMs: number; text: string; speaker?: string }[] = [];
  for (const s of segs) {
    const last = blocks[blocks.length - 1];
    if (last && s.startMs - last.startMs < 20_000 && last.speaker === s.speaker) {
      last.endMs = s.endMs;
      last.text += " " + middleEllipsis(s.text, 4);
    } else blocks.push({ startMs: s.startMs, endMs: s.endMs, text: middleEllipsis(s.text, 4), speaker: s.speaker });
  }
  const lines = blocks.map((b) => segLine(b, b.text));
  const text = lines.join("\n");
  if (estimateTokens(text) <= budgetTokens) return text;
  const keep = Math.max(5, Math.floor(lines.length * (budgetTokens / estimateTokens(text))));
  return [...lines.slice(0, keep), `  … ${lines.length - keep} more blocks until ${fmtSec(an.durationMs)}s`].join("\n");
}

function segLine(s: { startMs: number; endMs: number; speaker?: string }, text: string): string {
  return `  [${fmtSec(s.startMs)}-${fmtSec(s.endMs)}${s.speaker ? ` ${s.speaker}` : ""}] ${text.trim()}`;
}

export function middleEllipsis(text: string, maxWords: number): string {
  const w = text.trim().split(/\s+/);
  if (w.length <= maxWords) return text.trim();
  const head = Math.ceil(maxWords * 0.6);
  const tail = Math.max(1, maxWords - head);
  return `${w.slice(0, head).join(" ")} … ${w.slice(-tail).join(" ")}`;
}
