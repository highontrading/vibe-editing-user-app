/**
 * The deterministic edit engine. Turns (ProjectContext, Plan) into an EditScript
 * using ONLY edl ops, so the output is always valid. Claude sits on top of this:
 * it writes the plan and reviews/refines the result; in MOCK mode this engine
 * alone produces the edit.
 */
import {
  applyOp,
  ASPECT_SIZES,
  ASPECTS,
  CAPTION_STYLE_IDS,
  CAPTION_STYLES,
  CaptionSettingsSchema,
  COLOR_PRESETS,
  emptyScript,
  getTrack,
  mainClips,
  MUSIC_MOOD_INFO,
  MUSIC_MOODS,
  newId,
  parseScript,
  PLATFORM_PRESETS,
  PLATFORMS,
  SFX_LIBRARY,
  TRANSITION_TYPES,
  clipDuration,
  type Aspect,
  type AssetAnalysis,
  type AssetRef,
  type AudioClip,
  type CaptionSettings,
  type CaptionStyleId,
  type ColorPreset,
  type EditOp,
  type EditScript,
  type MusicMood,
  type Plan,
  type PlanStep,
  type Platform,
  type TransitionType,
  type VideoClip,
  type Word,
} from "@vibe/edl";
import type { AgentAsset, MediaProvider, ProjectContext } from "./types";
import { pickHooks, type Hook } from "./hooks";
import { fmtSec } from "./manifest";

/* ------------------------------------------------------------------ */
/* Parameters                                                          */
/* ------------------------------------------------------------------ */

export interface BuildParams {
  aspect: Aspect;
  platform: Platform;
  targetDurationMs?: number;
  title: string;
  hook: { enabled: boolean; text?: string; startMs?: number; endMs?: number; assetId?: string };
  cuts: { enabled: boolean; silenceThresholdMs: number; paddingMs: number; removeFillers: boolean; jumpCuts: boolean; transitions: TransitionType };
  pacing: { enabled: boolean; punchInEvery: number; punchInScale: number; speed: number };
  captions: { enabled: boolean; style: CaptionStyleId; emoji: boolean; uppercase?: boolean; maxWordsPerLine?: number; position?: "top" | "center" | "bottom"; fontSize?: number };
  music: { enabled: boolean; mood?: MusicMood; gainDb: number; ducking: boolean };
  sfx: { enabled: boolean; onPunchIns: boolean; titleImpact: boolean; whooshId: string };
  graphics: {
    enabled: boolean;
    title: boolean;
    titleText?: string;
    lowerThird: boolean;
    lowerThirdName?: string;
    lowerThirdTitle?: string;
    endCard: boolean;
    endCardText?: string;
    progressBar: boolean;
    subscribeBubble: boolean;
    handle?: string;
  };
  broll: { enabled: boolean; every: number; durationMs: number };
  color: { enabled: boolean; preset: ColorPreset; grain: number; vignette: number };
  length: { enabled: boolean };
  montage: { clipMinMs: number; clipMaxMs: number; zoomPulse: boolean; flashOnSection: boolean };
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}
function maybeOneOf<T extends string>(v: unknown, options: readonly T[]): T | undefined {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : undefined;
}

function stepOf(plan: Plan, kind: PlanStep["kind"]): PlanStep | undefined {
  return plan.steps.find((s) => s.kind === kind);
}

/** Merge recipe defaults, plan fields and step details into concrete builder parameters. */
export function resolveParams(ctx: ProjectContext, plan: Plan): BuildParams {
  const rd = (ctx.recipe?.defaults ?? {}) as Record<string, unknown>;
  const platform = oneOf<Platform>(plan.platform ?? ctx.platform, PLATFORMS, "custom");
  const aspect = oneOf<Aspect>(plan.aspect ?? ctx.aspect, ASPECTS, PLATFORM_PRESETS[platform].aspect);
  const d = (kind: PlanStep["kind"]) => (stepOf(plan, kind)?.detail ?? {}) as Record<string, unknown>;
  const on = (kind: PlanStep["kind"], fallback = false) => {
    const s = stepOf(plan, kind);
    return s ? s.enabled !== false : fallback;
  };
  const transitions = oneOf<TransitionType>(d("cuts").transitions ?? rd.transitions, TRANSITION_TYPES, "cut");
  const handle = ctx.brand?.handle ?? undefined;
  const musicMood = maybeOneOf<MusicMood>(d("music").mood ?? plan.musicMood ?? rd.musicMood, MUSIC_MOODS);
  return {
    aspect,
    platform,
    targetDurationMs: plan.targetDurationMs ?? (num(d("length").targetDurationMs, 0) || undefined) ?? ctx.targetDurationMs ?? undefined,
    title: str(d("graphics").titleText) ?? plan.title,
    hook: { enabled: on("hook"), text: str(d("hook").text), startMs: num(d("hook").startMs, NaN) || undefined, endMs: num(d("hook").endMs, NaN) || undefined, assetId: str(d("hook").assetId) },
    cuts: {
      enabled: on("cuts"),
      silenceThresholdMs: num(d("cuts").silenceThresholdMs ?? rd.silenceThresholdMs, 500),
      paddingMs: num(d("cuts").paddingMs, 120),
      removeFillers: bool(d("cuts").removeFillers ?? rd.removeFillers, true),
      jumpCuts: bool(d("cuts").jumpCuts, true),
      transitions,
    },
    pacing: {
      enabled: on("pacing"),
      punchInEvery: num(d("pacing").punchInEvery ?? rd.punchInEvery, 10_000),
      punchInScale: Math.min(1.3, Math.max(1.04, num(d("pacing").punchInScale ?? rd.punchInScale, 1.12))),
      speed: Math.min(2, Math.max(0.5, num(d("pacing").speed, 1))),
    },
    captions: {
      enabled: on("captions"),
      style: oneOf<CaptionStyleId>(d("captions").style ?? plan.captionStyle, CAPTION_STYLE_IDS, "bold-pop"),
      emoji: bool(d("captions").emoji, false),
      uppercase: typeof d("captions").uppercase === "boolean" ? (d("captions").uppercase as boolean) : undefined,
      maxWordsPerLine: num(d("captions").maxWordsPerLine, 0) || undefined,
      position: maybeOneOf(d("captions").position, ["top", "center", "bottom"] as const),
      fontSize: num(d("captions").fontSize, 0) || undefined,
    },
    music: { enabled: on("music") && !!musicMood, mood: musicMood, gainDb: num(d("music").gainDb ?? rd.musicGainDb, -18), ducking: bool(d("music").ducking, true) },
    sfx: { enabled: on("sfx"), onPunchIns: bool(d("sfx").onPunchIns ?? d("sfx").sfxOnCuts ?? rd.sfxOnCuts, true), titleImpact: bool(d("sfx").titleImpact, true), whooshId: oneOf(d("sfx").whooshId, SFX_LIBRARY.map((s) => s.id), "sfx-whoosh-1") },
    graphics: {
      enabled: on("graphics"),
      title: bool(d("graphics").title, true),
      titleText: str(d("graphics").titleText),
      lowerThird: bool(d("graphics").lowerThird, !!handle || !!str(d("graphics").lowerThirdName)),
      lowerThirdName: str(d("graphics").lowerThirdName) ?? handle,
      lowerThirdTitle: str(d("graphics").lowerThirdTitle),
      endCard: bool(d("graphics").endCard, true),
      endCardText: str(d("graphics").endCardText),
      progressBar: bool(d("graphics").progressBar ?? rd.progressBar, false),
      subscribeBubble: bool(d("graphics").subscribeBubble, false),
      handle,
    },
    broll: { enabled: on("broll"), every: num(d("broll").every ?? d("broll").brollEvery ?? rd.brollEvery, 12_000), durationMs: num(d("broll").durationMs, 3500) },
    color: { enabled: on("color"), preset: oneOf<ColorPreset>(d("color").preset ?? plan.colorPreset, COLOR_PRESETS, "none"), grain: Math.min(1, Math.max(0, num(d("color").grain, 0))), vignette: Math.min(1, Math.max(0, num(d("color").vignette, 0))) },
    length: { enabled: on("length", true) },
    montage: { clipMinMs: num(rd.clipMinMs, 1500), clipMaxMs: num(rd.clipMaxMs, 3000), zoomPulse: bool(rd.zoomPulse, true), flashOnSection: bool(rd.flashOnSection, true) },
  };
}

/** Return a new plan with steps toggled and/or top-level fields changed (the UI's inline plan edits). */
export function applyPlanTweaks(
  plan: Plan,
  tweaks: { disabledStepIds?: string[]; enabledStepIds?: string[]; captionStyle?: CaptionStyleId; musicMood?: MusicMood | null; colorPreset?: ColorPreset; targetDurationMs?: number | null; aspect?: Aspect; platform?: Platform; title?: string },
): Plan {
  const next: Plan = structuredClone(plan);
  for (const s of next.steps) {
    if (tweaks.disabledStepIds?.includes(s.id)) s.enabled = false;
    if (tweaks.enabledStepIds?.includes(s.id)) s.enabled = true;
  }
  if (tweaks.captionStyle) next.captionStyle = tweaks.captionStyle;
  if (tweaks.musicMood === null) {
    next.musicMood = undefined;
    for (const s of next.steps) if (s.kind === "music") s.enabled = false;
  } else if (tweaks.musicMood) {
    next.musicMood = tweaks.musicMood;
    for (const s of next.steps) if (s.kind === "music") s.detail = { ...s.detail, mood: tweaks.musicMood };
  }
  if (tweaks.colorPreset) next.colorPreset = tweaks.colorPreset;
  if (tweaks.targetDurationMs === null) next.targetDurationMs = undefined;
  else if (tweaks.targetDurationMs) next.targetDurationMs = Math.round(tweaks.targetDurationMs);
  if (tweaks.aspect) next.aspect = tweaks.aspect;
  if (tweaks.platform) next.platform = tweaks.platform;
  if (tweaks.title) next.title = tweaks.title;
  return next;
}

/* ------------------------------------------------------------------ */
/* Op recorder                                                         */
/* ------------------------------------------------------------------ */

export class OpRecorder {
  ops: EditOp[] = [];
  constructor(public script: EditScript) {}
  apply(op: EditOp): EditScript {
    this.script = applyOp(this.script, op);
    this.ops.push(op);
    return this.script;
  }
}

/**
 * edl's `setCaptionSettings` and `updateAudioClip` parse their partial payloads with
 * zod `.partial()`, which re-applies field defaults for anything omitted. Always send
 * the complete object so untouched fields survive.
 */
export function captionSettingsOp(script: EditScript, patch: Partial<CaptionSettings>): EditOp {
  const cur = getTrack(script, "captions")?.settings ?? CaptionSettingsSchema.parse({});
  return { op: "setCaptionSettings", settings: { ...cur, ...patch } };
}
export function audioClipPatchOp(clip: AudioClip, patch: Partial<Omit<AudioClip, "id">>): EditOp {
  const { id, ...rest } = clip;
  return { op: "updateAudioClip", clipId: id, patch: { ...rest, ...patch } };
}

/** Display text without filler words ("So um today" → "So today"). */
export function tidy(text: string): string {
  return text.replace(/\b(um+|uh+|erm|hmm|like,)\s*/gi, "").replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

/* ------------------------------------------------------------------ */
/* Source selection                                                    */
/* ------------------------------------------------------------------ */

export interface Span {
  inMs: number;
  outMs: number;
}
interface SourceClip extends Span {
  assetId: string;
  reason: string;
  isHook?: boolean;
  /** output-time punch-in marker set later */
  punch?: boolean;
}

export interface BuildStats {
  mode: "talking" | "montage";
  silencesCut: number;
  fillersCut: number;
  jumpCuts: number;
  hookText?: string;
  hookSourceMs?: number;
  punchIns: number;
  captionStyle?: CaptionStyleId;
  captionWords: number;
  musicMood?: MusicMood;
  sfxCount: number;
  graphics: string[];
  brollCount: number;
  colorPreset: ColorPreset;
  durationMs: number;
  sourceDurationMs: number;
  trimmedClips: number;
  clips: number;
  notes: string[];
}

function subtract(spans: Span[], removals: Span[]): Span[] {
  const sorted = [...removals].filter((r) => r.outMs > r.inMs).sort((a, b) => a.inMs - b.inMs);
  const merged: Span[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.inMs <= last.outMs) last.outMs = Math.max(last.outMs, r.outMs);
    else merged.push({ ...r });
  }
  let out: Span[] = spans.map((s) => ({ ...s }));
  for (const r of merged) {
    const next: Span[] = [];
    for (const s of out) {
      if (r.outMs <= s.inMs || r.inMs >= s.outMs) {
        next.push(s);
        continue;
      }
      if (r.inMs > s.inMs) next.push({ inMs: s.inMs, outMs: r.inMs });
      if (r.outMs < s.outMs) next.push({ inMs: r.outMs, outMs: s.outMs });
    }
    out = next;
  }
  return out.filter((s) => s.outMs - s.inMs >= 450);
}

function intersect(spans: Span[], range: Span): Span[] {
  return spans
    .map((s) => ({ inMs: Math.max(s.inMs, range.inMs), outMs: Math.min(s.outMs, range.outMs) }))
    .filter((s) => s.outMs - s.inMs >= 250);
}

function wordsIn(an: AssetAnalysis | null, span: Span) {
  return (an?.transcript?.words ?? []).filter((w) => w.t >= span.inMs && w.t < span.outMs);
}

const KEYWORD_RE = /^(\d|[A-Z][a-z]{3,})|[a-z]{9,}/;
function valueScore(an: AssetAnalysis | null, span: Span): number {
  const words = wordsIn(an, span);
  const keywords = words.filter((w) => KEYWORD_RE.test(w.text.replace(/[^\w]/g, ""))).length;
  const seconds = Math.max(0.5, (span.outMs - span.inMs) / 1000);
  return (words.length + keywords * 2) / seconds;
}

/** Choose the hook for an asset: plan-provided > analysis.hooks > scored segments. */
function chooseHook(a: AgentAsset, params: BuildParams): Hook | undefined {
  if (!params.hook.enabled) return undefined;
  if (params.hook.assetId && params.hook.assetId !== a.ref.id) return undefined;
  if (params.hook.startMs !== undefined && params.hook.endMs !== undefined && params.hook.endMs > params.hook.startMs) {
    return { startMs: params.hook.startMs, endMs: params.hook.endMs, text: params.hook.text ?? "", score: 99 };
  }
  const an = a.analysis;
  if (!an) return undefined;
  const candidates = an.hooks.length ? [...an.hooks].sort((x, y) => y.score - x.score) : pickHooks(an);
  if (params.hook.text) {
    const needle = params.hook.text.toLowerCase().slice(0, 30);
    const match = candidates.find((h) => h.text.toLowerCase().includes(needle)) ?? an.transcript?.segments.find((s) => s.text.toLowerCase().includes(needle));
    if (match) return { startMs: match.startMs, endMs: match.endMs, text: match.text, score: 99 };
  }
  return candidates[0];
}

/** Compute the ordered source clips for talking content (silences, fillers, jump cuts, hook first). */
export function selectTalkingClips(assets: AgentAsset[], params: BuildParams, stats: BuildStats): SourceClip[] {
  const clips: SourceClip[] = [];
  let hookClips: SourceClip[] = [];
  let bestHook: { hook: Hook; asset: AgentAsset } | undefined;
  for (const a of assets) {
    const h = chooseHook(a, params);
    if (h && (!bestHook || h.score > bestHook.hook.score)) bestHook = { hook: h, asset: a };
  }
  for (const a of assets) {
    const an = a.analysis;
    const dur = an?.durationMs ?? a.ref.durationMs ?? 0;
    if (dur <= 0) continue;
    let spans: Span[] = [{ inMs: 0, outMs: dur }];
    const removals: Span[] = [];
    const gapReasons = new Map<number, string>(); // keyed by removal.outMs
    if (params.cuts.enabled && an) {
      for (const s of an.audio?.silences ?? []) {
        const len = s.endMs - s.startMs;
        if (len > params.cuts.silenceThresholdMs) {
          const r = { inMs: s.startMs + params.cuts.paddingMs, outMs: s.endMs - params.cuts.paddingMs };
          if (r.outMs - r.inMs >= 80) {
            removals.push(r);
            gapReasons.set(r.outMs, `Cut a ${(len / 1000).toFixed(1)} s pause`);
            stats.silencesCut++;
          }
        }
      }
      if (params.cuts.removeFillers) {
        for (const f of an.quality?.fillers ?? []) {
          const r = { inMs: Math.max(0, f.startMs - 30), outMs: f.endMs + 30 };
          removals.push(r);
          gapReasons.set(r.outMs, `Removed filler "${f.text}"`);
          stats.fillersCut++;
        }
      }
      spans = subtract(spans, removals);
    }
    // Hook first: lift the hook range out of the main spans.
    if (bestHook && bestHook.asset.ref.id === a.ref.id) {
      const h = bestHook.hook;
      const range = { inMs: Math.max(0, h.startMs - 80), outMs: Math.min(dur, h.endMs + 120) };
      let pieces = intersect(spans, range);
      // A filler removed right after the first word leaves a stub ("So" | "um" | …): drop leading stubs.
      while (pieces.length > 1 && pieces[0]!.outMs - pieces[0]!.inMs < 700) pieces = pieces.slice(1);
      if (pieces.length) {
        const text = params.cuts.removeFillers ? tidy(h.text) : h.text;
        hookClips = pieces.map((p, i) => ({ ...p, assetId: a.ref.id, isHook: true, reason: i === 0 ? `Opened with your line "${truncate(text, 60)}" (hook score ${h.score.toFixed(1)})` : "Rest of the hook line" }));
        spans = subtract(spans, [range]);
        gapReasons.set(range.outMs, "Continues after the hook line, which now opens the video");
        stats.hookText = text;
        stats.hookSourceMs = h.startMs;
      }
    }
    // Jump cuts on sentence boundaries.
    if (params.cuts.enabled && params.cuts.jumpCuts && an?.transcript?.segments.length) {
      const points = an.transcript.segments.map((s) => s.endMs).sort((x, y) => x - y);
      const next: Span[] = [];
      for (const s of spans) {
        let cur = s.inMs;
        for (const p of points) {
          if (p - cur >= 1200 && s.outMs - p >= 1200) {
            next.push({ inMs: cur, outMs: p });
            cur = p;
            stats.jumpCuts++;
          }
        }
        next.push({ inMs: cur, outMs: s.outMs });
      }
      spans = next;
    }
    let prevOut = -1;
    for (const s of spans) {
      let reason = "Kept";
      const near = (at: number) => {
        let best: string | undefined;
        let bestD = 201;
        for (const [k, v] of gapReasons) if (Math.abs(k - at) < bestD) (bestD = Math.abs(k - at)), (best = v);
        return best;
      };
      if (prevOut >= 0) {
        if (s.inMs - prevOut <= 1) reason = "Jump cut on a sentence break";
        else reason = near(s.inMs) ?? `Cut ${((s.inMs - prevOut) / 1000).toFixed(1)} s`;
      } else if (s.inMs > 0) reason = near(s.inMs) ?? `Trimmed ${(s.inMs / 1000).toFixed(1)} s off the start`;
      clips.push({ ...s, assetId: a.ref.id, reason });
      prevOut = s.outMs;
    }
  }
  return [...hookClips, ...clips];
}

/** Keep the highest-value clips until the total fits the target (never drops the hook). */
export function trimClipsToTarget(assets: AgentAsset[], clips: SourceClip[], targetMs: number, stats: BuildStats): SourceClip[] {
  const byId = new Map(assets.map((a) => [a.ref.id, a.analysis] as const));
  const total = () => clips.reduce((n, c) => n + (c.outMs - c.inMs), 0);
  if (total() <= targetMs * 1.05) return clips;
  const scored = clips.map((c) => ({ c, score: c.isHook ? Infinity : valueScore(byId.get(c.assetId) ?? null, c) }));
  const order = [...scored].filter((s) => !s.c.isHook).sort((a, b) => a.score - b.score);
  for (const cand of order) {
    if (total() <= targetMs * 1.05) break;
    if (clips.length <= 2) break;
    const d = cand.c.outMs - cand.c.inMs;
    if (total() - d < targetMs * 0.85) continue;
    const idx = clips.indexOf(cand.c);
    if (idx >= 0) {
      clips.splice(idx, 1);
      stats.trimmedClips++;
    }
  }
  // Still long: trim the tail of the last clip.
  if (total() > targetMs * 1.08) {
    const last = clips[clips.length - 1]!;
    const over = total() - targetMs;
    if (last.outMs - last.inMs - over >= 1500) {
      last.outMs -= Math.round(over);
      last.reason += " (trimmed to length)";
      stats.trimmedClips++;
    }
  }
  return clips;
}

/* ------------------------------------------------------------------ */
/* Captions                                                            */
/* ------------------------------------------------------------------ */

export const EMOJI_MAP: Record<string, string> = {
  money: "💰", cash: "💰", dollars: "💵", rich: "🤑", love: "❤️", heart: "❤️", fire: "🔥", hot: "🔥", rocket: "🚀", launch: "🚀", idea: "💡", ideas: "💡",
  mistake: "❌", mistakes: "❌", wrong: "❌", stop: "🛑", never: "🚫", time: "⏰", clock: "⏰", growth: "📈", grow: "📈", brain: "🧠", think: "🧠",
  win: "🏆", winner: "🏆", secret: "🤫", warning: "⚠️", food: "🍔", pizza: "🍕", coffee: "☕", travel: "✈️", flight: "✈️", work: "💻", laptop: "💻",
  phone: "📱", happy: "😊", sad: "😢", music: "🎵", camera: "📷", video: "🎬", star: "⭐", sun: "☀️", party: "🎉", gift: "🎁", book: "📚",
  car: "🚗", home: "🏠", house: "🏠", dog: "🐶", cat: "🐱", world: "🌍", hundred: "💯", percent: "📊", goal: "🎯", target: "🎯", key: "🔑",
  eyes: "👀", look: "👀", muscle: "💪", strong: "💪", sleep: "😴", crazy: "🤯", mind: "🤯", question: "❓", yes: "✅", done: "✅", free: "🆓",
  new: "🆕", gym: "🏋️", run: "🏃", water: "💧", beach: "🏖️", mountain: "🏔️", city: "🏙️", night: "🌙", morning: "🌅", email: "📧", pay: "💳",
};

const STOPWORDS = new Set("the a an and or but if then so of to in on at for with from by as is are was were be been being it its this that these those i you he she we they me him her us them my your his our their what which who whom whose when where why how not no yes do does did done have has had will would can could should may might must just very really also too there here about into over under again more most some any all each both few other such only own same than".split(" "));

export function emphasize(text: string, isSentenceStart: boolean): boolean {
  const clean = text.replace(/[^\p{L}\p{N}]/gu, "");
  if (!clean) return false;
  if (/\d/.test(clean)) return true;
  if (STOPWORDS.has(clean.toLowerCase())) return false;
  if (clean.length >= 8) return true;
  if (!isSentenceStart && /^\p{Lu}/u.test(clean) && clean.length >= 3) return true;
  return false;
}

/** Map transcript words of the main clips onto the output timeline. */
export function captionWordsForScript(script: EditScript, assets: AgentAsset[], opts: { emoji: boolean }): Word[] {
  const byId = new Map(assets.map((a) => [a.ref.id, a.analysis] as const));
  const words: Word[] = [];
  for (const clip of mainClips(script)) {
    const an = byId.get(clip.assetId);
    const tw = an?.transcript?.words ?? [];
    const speed = clip.speed || 1;
    const outDur = clipDuration(clip);
    let source = tw.filter((w) => w.t + Math.min(w.d, 200) > clip.inMs && w.t < clip.outMs);
    if (!source.length && an?.transcript?.segments.length) {
      // No word timings: synthesise evenly spaced words from the segment texts.
      for (const seg of an.transcript.segments) {
        if (seg.endMs <= clip.inMs || seg.startMs >= clip.outMs) continue;
        const parts = seg.text.trim().split(/\s+/).filter(Boolean);
        const step = (seg.endMs - seg.startMs) / Math.max(1, parts.length);
        parts.forEach((text, i) => source.push({ t: Math.round(seg.startMs + i * step), d: Math.round(step * 0.9), text, speaker: seg.speaker }));
      }
      source = source.filter((w) => w.t >= clip.inMs && w.t < clip.outMs);
    }
    let prevEnd = -1;
    for (const w of source) {
      const relStart = Math.max(0, w.t - clip.inMs);
      const t = clip.startMs + Math.round(relStart / speed);
      const d = Math.max(80, Math.min(Math.round(w.d / speed), clip.startMs + outDur - t));
      if (d <= 0) continue;
      const sentenceStart = prevEnd < 0 || w.t - prevEnd > 600 || /[.!?]$/.test(words[words.length - 1]?.text ?? "");
      const text = w.text.trim();
      if (!text) continue;
      const word: Word = { t, d, text, speaker: w.speaker };
      if (emphasize(text, sentenceStart)) word.emphasis = true;
      if (opts.emoji) {
        const e = EMOJI_MAP[text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")];
        if (e) word.emoji = e;
      }
      words.push(word);
      prevEnd = w.t + w.d;
    }
  }
  return words;
}

export function captionSettingsFor(style: CaptionStyleId, overrides: Partial<{ emoji: boolean; uppercase: boolean; maxWordsPerLine: number; position: "top" | "center" | "bottom"; fontSize: number }>, platform: Platform) {
  const info = CAPTION_STYLES.find((s) => s.id === style);
  const settings: Record<string, unknown> = { ...(info?.defaults ?? {}) };
  // Safe zones: on vertical platforms "bottom" captions move up to the centre band.
  if (["tiktok", "reels", "shorts"].includes(platform) && settings.position === "bottom") settings.position = "center";
  if (overrides.emoji !== undefined) settings.emoji = overrides.emoji;
  if (overrides.uppercase !== undefined) settings.uppercase = overrides.uppercase;
  if (overrides.maxWordsPerLine) settings.maxWordsPerLine = overrides.maxWordsPerLine;
  if (overrides.position) settings.position = overrides.position;
  if (overrides.fontSize) settings.fontSize = overrides.fontSize;
  return settings;
}

/* ------------------------------------------------------------------ */
/* Media helpers (shared with the edit tools)                           */
/* ------------------------------------------------------------------ */

export function ensureBrollTrack(rec: OpRecorder): string {
  const existing = rec.script.tracks.find((t) => t.kind === "video" && t.layer > 0);
  if (existing) return existing.id;
  // No addTrack op exists in edl: compose it from replaceScript with the track appended.
  const next = structuredClone(rec.script);
  next.tracks.splice(1, 0, { id: "v-broll", kind: "video", layer: 1, clips: [], name: "B-roll" });
  rec.apply({ op: "replaceScript", script: next });
  return "v-broll";
}

export async function setMusic(rec: OpRecorder, media: MediaProvider, projectId: string, mood: MusicMood, gainDb: number, ducking: boolean, reason?: string): Promise<AssetRef | null> {
  for (const t of rec.script.tracks) if (t.kind === "audio" && t.role === "music") for (const c of [...t.clips]) rec.apply({ op: "deleteAudioClip", clipId: c.id });
  const durationMs = Math.max(1000, rec.script.output.durationMs);
  let asset: AssetRef;
  try {
    asset = await media.getMusic({ mood, durationMs, projectId });
  } catch (e) {
    return null;
  }
  rec.apply({ op: "registerAsset", asset: { ...asset, kind: "audio", source: asset.source ?? "library" } });
  const loop = asset.durationMs !== undefined && asset.durationMs < durationMs;
  rec.apply({
    op: "addAudioClip",
    role: "music",
    clip: { assetId: asset.id, startMs: 0, inMs: 0, outMs: durationMs, gainDb, ducking, loop, fadeInMs: 500, fadeOutMs: 1500, label: `${mood} bed`, reason: reason ?? `${capitalize(mood)} bed at ${gainDb} dB${ducking ? ", ducked under speech" : ""}` },
  });
  return asset;
}

export async function addSfx(rec: OpRecorder, media: MediaProvider, projectId: string, sfxId: string, atMs: number, reason: string, cache: Map<string, AssetRef | null>): Promise<boolean> {
  let asset = cache.get(sfxId);
  if (asset === undefined) {
    try {
      asset = await media.getSfx({ sfxId, projectId });
    } catch {
      asset = null;
    }
    cache.set(sfxId, asset);
    if (asset) rec.apply({ op: "registerAsset", asset: { ...asset, kind: "audio", source: asset.source ?? "library" } });
  }
  if (!asset) return false;
  const lib = SFX_LIBRARY.find((s) => s.id === sfxId);
  const d = Math.min(asset.durationMs ?? lib?.durationMs ?? 500, lib?.durationMs ?? 1000);
  rec.apply({ op: "addAudioClip", role: "sfx", clip: { assetId: asset.id, startMs: Math.max(0, Math.round(atMs)), inMs: 0, outMs: d, gainDb: -8, label: lib?.name ?? sfxId, reason } });
  return true;
}

export async function addBroll(rec: OpRecorder, media: MediaProvider, projectId: string, query: string, atMs: number, durationMs: number, aspect: Aspect, reason: string): Promise<boolean> {
  const orientation = aspect === "9:16" || aspect === "4:5" ? "portrait" : aspect === "1:1" ? "square" : "landscape";
  let results: AssetRef[] = [];
  try {
    results = await media.searchStock({ query, kind: "video", orientation, projectId, limit: 3 });
  } catch {
    return false;
  }
  const used = new Set(Object.keys(rec.script.assets));
  const pick = results.find((r) => !used.has(r.id)) ?? results[0];
  if (!pick) return false;
  const trackId = ensureBrollTrack(rec);
  if (!rec.script.assets[pick.id]) rec.apply({ op: "registerAsset", asset: { ...pick, source: pick.source ?? "stock" } });
  const d = Math.max(1000, Math.min(durationMs, pick.durationMs ?? durationMs));
  rec.apply({ op: "addVideoClip", trackId, clip: { assetId: pick.id, startMs: Math.round(atMs), inMs: 0, outMs: d, volume: 0, label: `B-roll: ${query}`, reason } });
  return true;
}

/** Query for stock footage from the words spoken in a window: the most specific nouns. */
export function brollQuery(words: { text: string }[], fallback = "abstract background"): string {
  const freq = new Map<string, number>();
  for (const w of words) {
    const clean = w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (clean.length < 4 || STOPWORDS.has(clean) || /^(really|thing|things|something|everything|anything|nothing|someone|everyone|anyone|people|going|gonna|right|okay|actually|because|about|would|could|should|there|their|where|which|every|still|other|those|these|being|think|know|like|want|make|made|much|many|even|also|well|back|first|need|time|year|years|good|great|little|lot|next|last|here|today|video|follow|exact|changed|alone|moment|instead)$/.test(clean)) continue;
    const verbish = /(ed|ing|ly|es)$/.test(clean) ? 0.4 : 1;
    freq.set(clean, (freq.get(clean) ?? 0) + (1 + (w.text[0] === w.text[0]?.toUpperCase() && /^\p{L}/u.test(w.text) ? 0.5 : 0) + clean.length / 20) * verbish);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  return top.length ? top.join(" ") : fallback;
}

/* ------------------------------------------------------------------ */
/* Script-level helpers (duration changes)                              */
/* ------------------------------------------------------------------ */

/** Re-anchor end-of-video items after any duration change: end card, progress bar, music bed length. */
export function normalizeEnds(rec: OpRecorder): void {
  const dur = rec.script.output.durationMs;
  const gfx = getTrack(rec.script, "graphics");
  if (gfx) {
    for (const g of gfx.items) {
      if (g.component === "EndCard") {
        const want = Math.max(0, dur - g.durationMs);
        if (g.startMs !== want) rec.apply({ op: "updateGraphic", itemId: g.id, patch: { startMs: want } });
      }
      if (g.component === "ProgressBar" || g.component === "LogoBug") {
        if (g.startMs !== 0 || g.durationMs !== dur) rec.apply({ op: "updateGraphic", itemId: g.id, patch: { startMs: 0, durationMs: dur } });
      }
    }
  }
  for (const t of rec.script.tracks) {
    if (t.kind === "audio" && t.role === "music") {
      for (const c of t.clips) {
        const want = Math.max(1000, dur - c.startMs);
        if (c.outMs !== want) rec.apply(audioClipPatchOp(c, { outMs: want }));
      }
    }
  }
}

/** Trim an existing script to a target length by dropping the least valuable clips (words per second from the caption track), then the tail. */
export function trimScriptToTarget(rec: OpRecorder, targetMs: number): { removed: number; trimmedTail: boolean } {
  let removed = 0;
  let trimmedTail = false;
  const words = getTrack(rec.script, "captions")?.words ?? [];
  const value = (c: VideoClip) => {
    const end = c.startMs + clipDuration(c);
    const inside = words.filter((w) => w.t >= c.startMs && w.t < end);
    const kw = inside.filter((w) => w.emphasis).length;
    return (inside.length + kw * 2) / Math.max(0.5, clipDuration(c) / 1000);
  };
  const total = () => rec.script.output.durationMs;
  if (total() <= targetMs * 1.05) return { removed, trimmedTail };
  // The first clip is the hook: protected.
  for (let guard = 0; guard < 200 && total() > targetMs * 1.05; guard++) {
    const clips = mainClips(rec.script);
    if (clips.length <= 2) break;
    const candidates = clips.slice(1).map((c) => ({ c, v: value(c) })).sort((a, b) => a.v - b.v);
    const pick = candidates.find((x) => total() - clipDuration(x.c) >= targetMs * 0.85);
    if (!pick) break;
    rec.apply({ op: "deleteClip", clipId: pick.c.id });
    removed++;
  }
  if (total() > targetMs * 1.08) {
    const clips = mainClips(rec.script);
    const last = clips[clips.length - 1];
    if (last) {
      const over = total() - targetMs;
      const keep = clipDuration(last) - over;
      if (keep >= 1500) {
        rec.apply({ op: "trimClip", clipId: last.id, outMs: last.inMs + Math.round(keep * (last.speed || 1)) });
        trimmedTail = true;
      } else if (clips.length > 1) {
        rec.apply({ op: "deleteClip", clipId: last.id });
        removed++;
      }
    }
  }
  normalizeEnds(rec);
  return { removed, trimmedTail };
}

/* ------------------------------------------------------------------ */
/* The build                                                           */
/* ------------------------------------------------------------------ */

export interface BuildOutput {
  script: EditScript;
  stats: BuildStats;
  ops: EditOp[];
  params: BuildParams;
}

function baseScript(params: BuildParams, title: string, recipeId?: string): EditScript {
  const size = ASPECT_SIZES[params.aspect];
  return parseScript({
    version: 1,
    output: { ...size, fps: 30, durationMs: 0 },
    assets: {},
    tracks: [
      { id: "v-main", kind: "video", layer: 0, clips: [], name: "Main" },
      { id: "v-broll", kind: "video", layer: 1, clips: [], name: "B-roll" },
      { id: "captions", kind: "captions", style: params.captions.style, words: [], enabled: true, name: "Captions" },
      { id: "a-music", kind: "audio", role: "music", clips: [], muted: false, name: "Music" },
      { id: "a-sfx", kind: "audio", role: "sfx", clips: [], muted: false, name: "SFX" },
      { id: "gfx", kind: "graphics", items: [], name: "Graphics" },
    ],
    meta: { title, platform: params.platform, aspect: params.aspect, recipeId },
  });
}

export function hasSpeech(a: AgentAsset): boolean {
  const t = a.analysis?.transcript;
  return !!t && (t.words.length > 0 || t.segments.length > 0);
}

export async function buildFromPlan(ctx: ProjectContext, plan: Plan, media: MediaProvider): Promise<BuildOutput> {
  const params = resolveParams(ctx, plan);
  const assets = ctx.assets.filter((a) => a.ref.kind === "video" && (a.analysis?.durationMs ?? a.ref.durationMs ?? 0) > 0);
  const talking = assets.some(hasSpeech);
  const stats: BuildStats = {
    mode: talking ? "talking" : "montage",
    silencesCut: 0, fillersCut: 0, jumpCuts: 0, punchIns: 0, captionWords: 0, sfxCount: 0, graphics: [], brollCount: 0,
    colorPreset: "none", durationMs: 0, sourceDurationMs: assets.reduce((n, a) => n + (a.analysis?.durationMs ?? a.ref.durationMs ?? 0), 0), trimmedClips: 0, clips: 0, notes: [],
  };
  const rec = new OpRecorder(baseScript(params, plan.title, ctx.recipe?.slug));
  for (const a of assets) rec.apply({ op: "registerAsset", asset: { ...a.ref, durationMs: a.ref.durationMs ?? a.analysis?.durationMs, width: a.ref.width ?? a.analysis?.width, height: a.ref.height ?? a.analysis?.height } });
  if (!assets.length) {
    stats.notes.push("No video assets to build from.");
    return { script: rec.script, stats, ops: rec.ops, params };
  }

  if (talking) await buildTalking(ctx, assets, params, rec, stats, media);
  else await buildMontage(ctx, assets, params, rec, stats, media);

  // Colour
  if (params.color.enabled && params.color.preset !== "none") {
    rec.apply({ op: "setColorPreset", preset: params.color.preset });
    const grain = params.color.grain || (params.color.preset === "warm-film" ? 0.15 : 0);
    const vignette = params.color.vignette || (params.color.preset === "moody" || params.color.preset === "teal-orange" ? 0.2 : 0);
    if (grain || vignette) rec.apply({ op: "setGlobal", patch: { grain, vignette } });
    stats.colorPreset = params.color.preset;
  }
  rec.apply({ op: "setMeta", patch: { title: plan.title, notes: plan.summary } });
  normalizeEnds(rec);
  stats.durationMs = rec.script.output.durationMs;
  stats.clips = mainClips(rec.script).length;
  return { script: rec.script, stats, ops: rec.ops, params };
}

async function buildTalking(ctx: ProjectContext, assets: AgentAsset[], params: BuildParams, rec: OpRecorder, stats: BuildStats, media: MediaProvider) {
  let clips = selectTalkingClips(assets, params, stats);
  const target = params.length.enabled ? params.targetDurationMs : undefined;
  const platformMax = PLATFORM_PRESETS[params.platform].maxDurationMs;
  const effectiveTarget = Math.min(target ?? Infinity, platformMax);
  if (Number.isFinite(effectiveTarget)) clips = trimClipsToTarget(assets, clips, effectiveTarget, stats);

  // Punch-in rhythm, decided on clip boundaries.
  let scale = 1;
  let sinceToggle = 0;
  const speed = params.pacing.enabled ? params.pacing.speed : 1;
  let cursor = 0;
  const ids: string[] = [];
  const punchAt: number[] = [];
  clips.forEach((c, i) => {
    const outDur = Math.round((c.outMs - c.inMs) / speed);
    let reason = c.reason;
    if (params.pacing.enabled && i > 0 && !clips[i - 1]!.isHook === !c.isHook && sinceToggle >= params.pacing.punchInEvery) {
      scale = scale === 1 ? params.pacing.punchInScale : 1;
      sinceToggle = 0;
      reason += scale > 1 ? ` · punch-in to ${Math.round(scale * 100)}% to reset attention` : " · back to full frame";
      stats.punchIns++;
      punchAt.push(cursor);
    } else if (params.pacing.enabled && i > 0 && clips[i - 1]!.isHook && !c.isHook) {
      // After the hook, return to full frame so the hook stands out.
      if (scale !== 1) {
        scale = 1;
        sinceToggle = 0;
      }
    }
    const id = newId("clip");
    ids.push(id);
    rec.apply({
      op: "addVideoClip",
      clip: { id, assetId: c.assetId, startMs: cursor, inMs: c.inMs, outMs: c.outMs, speed, transform: { scale, x: 0, y: 0, rotate: 0 }, reason, label: c.isHook ? "Hook" : undefined },
    });
    // Transitions: only on "real" cuts (silence gaps or asset changes), never on jump cuts.
    if (params.cuts.transitions !== "cut" && i > 0) {
      const prev = clips[i - 1]!;
      const realCut = prev.assetId !== c.assetId || Math.abs(c.inMs - prev.outMs) > 1000 || prev.isHook;
      if (realCut) rec.apply({ op: "setTransition", clipId: id, side: "in", transition: { type: params.cuts.transitions, durationMs: params.cuts.transitions === "crossfade" ? 400 : params.cuts.transitions === "whip" ? 250 : 300 } });
    }
    cursor += outDur;
    sinceToggle += outDur;
  });
  const duration = rec.script.output.durationMs;

  // Captions
  if (params.captions.enabled) {
    const words = captionWordsForScript(rec.script, assets, { emoji: params.captions.emoji });
    rec.apply({ op: "setCaptionStyle", style: params.captions.style });
    rec.apply({ op: "setCaptionSettings", settings: CaptionSettingsSchema.parse(captionSettingsFor(params.captions.style, params.captions, params.platform)) });
    rec.apply({ op: "setCaptionWords", words });
    stats.captionWords = words.length;
    stats.captionStyle = params.captions.style;
  } else {
    rec.apply({ op: "setCaptionsEnabled", enabled: false });
  }

  // Graphics
  const gfxStart = params.graphics.enabled;
  const titleText = params.graphics.titleText ?? params.title;
  if (gfxStart && params.graphics.title && titleText && duration >= 4000) {
    rec.apply({ op: "addGraphic", item: { component: "KineticTitle", startMs: 0, durationMs: 2500, props: { text: titleText, align: "top", style: "slam", accent: ctx.brand?.colors?.[0] ?? "#FFD400" }, reason: `Title states the topic in the first 2.5 s` } });
    stats.graphics.push("title");
  }
  if (gfxStart && params.graphics.lowerThird && params.graphics.lowerThirdName && duration >= 8000) {
    rec.apply({ op: "addGraphic", item: { component: "LowerThird", startMs: 2800, durationMs: 4000, props: { name: params.graphics.lowerThirdName, title: params.graphics.lowerThirdTitle ?? "", accent: ctx.brand?.colors?.[0] ?? "#FFD400" }, reason: "Introduce the speaker once, early" } });
    stats.graphics.push("lower third");
  }
  if (gfxStart && params.graphics.progressBar && duration >= 20_000) {
    rec.apply({ op: "addGraphic", item: { component: "ProgressBar", startMs: 0, durationMs: duration, props: { position: "top", color: ctx.brand?.colors?.[0] ?? "#FFD400" }, reason: "Progress bar keeps viewers through a longer piece" } });
    stats.graphics.push("progress bar");
  }
  if (gfxStart && params.graphics.subscribeBubble && duration >= 15_000) {
    rec.apply({ op: "addGraphic", item: { component: "SubscribeBubble", startMs: Math.round(duration * 0.45), durationMs: 2500, props: { label: params.platform === "youtube" || params.platform === "shorts" ? "Subscribe" : "Follow", platform: params.platform === "youtube" || params.platform === "shorts" ? "youtube" : params.platform === "reels" ? "instagram" : params.platform === "tiktok" ? "tiktok" : "generic" }, reason: "Mid-video follow nudge" } });
    stats.graphics.push("subscribe bubble");
  }
  if (gfxStart && params.graphics.endCard && duration >= 12_000) {
    rec.apply({ op: "addGraphic", item: { component: "EndCard", startMs: duration - 3000, durationMs: 3000, props: { headline: params.graphics.endCardText ?? "Follow for more", handle: params.graphics.handle ?? "", accent: ctx.brand?.colors?.[0] ?? "#FFD400" }, reason: "One call to action in the last 3 s" } });
    stats.graphics.push("end card");
  }

  // Music
  if (params.music.enabled && params.music.mood) {
    const asset = await setMusic(rec, media, ctx.projectId, params.music.mood, params.music.gainDb, params.music.ducking);
    if (asset) stats.musicMood = params.music.mood;
    else stats.notes.push("Music library unavailable: no bed added.");
  }

  // SFX (restraint: whoosh on punch-ins, impact under the title, spaced >= 4 s, max 8)
  if (params.sfx.enabled) {
    const cache = new Map<string, AssetRef | null>();
    let last = -Infinity;
    if (params.sfx.titleImpact && stats.graphics.includes("title")) {
      if (await addSfx(rec, media, ctx.projectId, "sfx-impact", 0, "Impact under the title slam", cache)) {
        stats.sfxCount++;
        last = 0;
      }
    }
    if (params.sfx.onPunchIns) {
      for (const t of punchAt) {
        if (stats.sfxCount >= 8) break;
        if (t - last < 4000 || t > duration - 800) continue;
        if (await addSfx(rec, media, ctx.projectId, params.sfx.whooshId, Math.max(0, t - 60), "Whoosh on the punch-in", cache)) {
          stats.sfxCount++;
          last = t;
        }
      }
    }
  }

  // B-roll over long talking stretches
  if (params.broll.enabled && duration > params.broll.every + 4000) {
    const main = mainClips(rec.script);
    const words = getTrack(rec.script, "captions")?.words ?? [];
    let since = -4000; // leave the hook clear
    for (const c of main) {
      const d = clipDuration(c);
      since += d;
      if (since >= params.broll.every && d >= params.broll.durationMs + 1200 && c.startMs + params.broll.durationMs + 1500 < duration - 3000) {
        const at = c.startMs + 600;
        const windowWords = words.filter((w) => w.t >= at - 2000 && w.t < at + params.broll.durationMs + 2000);
        const query = brollQuery(windowWords);
        const ok = await addBroll(rec, media, ctx.projectId, query, at, params.broll.durationMs, params.aspect, `B-roll of "${query}" while you talk about it (${Math.round(since / 1000)} s without a visual change)`);
        if (ok) {
          stats.brollCount++;
          since = 0;
        }
      }
    }
  }
}

async function buildMontage(ctx: ProjectContext, assets: AgentAsset[], params: BuildParams, rec: OpRecorder, stats: BuildStats, media: MediaProvider) {
  const mood: MusicMood = params.music.mood ?? "energetic";
  const info = MUSIC_MOOD_INFO.find((m) => m.id === mood)!;
  const bpm = Math.round((info.bpm[0] + info.bpm[1]) / 2);
  const beat = 60_000 / bpm;
  let clipLen = beat * 2;
  while (clipLen < params.montage.clipMinMs) clipLen *= 2;
  while (clipLen > params.montage.clipMaxMs && clipLen / 2 >= params.montage.clipMinMs) clipLen /= 2;
  clipLen = Math.round(clipLen);
  const totalSource = assets.reduce((n, a) => n + (a.analysis?.durationMs ?? a.ref.durationMs ?? 0), 0);
  const target = Math.min(params.targetDurationMs ?? 30_000, PLATFORM_PRESETS[params.platform].maxDurationMs, Math.max(clipLen * 2, totalSource));

  // Candidate moments per asset: shot starts (prefer motion/faces tags), else a grid.
  const moments: { assetId: string; inMs: number; max: number; weight: number }[][] = assets.map((a) => {
    const dur = a.analysis?.durationMs ?? a.ref.durationMs ?? 0;
    const shots = a.analysis?.shots ?? [];
    const list: { assetId: string; inMs: number; max: number; weight: number }[] = [];
    if (shots.length) {
      for (const s of shots) {
        const len = s.endMs - s.startMs;
        if (len < 700) continue;
        const inMs = Math.round(s.startMs + Math.min(len * 0.15, 800));
        const weight = 1 + (s.tags.some((t) => /motion|action|face|person|people|closeup|close-up/.test(t)) ? 1 : 0) + (s.description ? 0.3 : 0);
        list.push({ assetId: a.ref.id, inMs, max: s.endMs, weight });
      }
    }
    if (!list.length) for (let t = 0; t + clipLen <= dur; t += clipLen * 2) list.push({ assetId: a.ref.id, inMs: t, max: dur, weight: 1 });
    return list;
  });
  const cursors = assets.map(() => 0);
  let cursor = 0;
  let i = 0;
  let guard = 0;
  const count = Math.ceil(target / clipLen) + 2;
  while (cursor < target && guard++ < 500) {
    const ai = i % assets.length;
    const list = moments[ai]!;
    if (!list.length) {
      i++;
      if (moments.every((l) => !l.length)) break;
      continue;
    }
    const m = list[cursors[ai]! % list.length]!;
    cursors[ai]!++;
    const accelerate = cursor > target * 0.75;
    const len = Math.max(800, Math.round(accelerate ? clipLen / 2 : clipLen));
    const outMs = Math.min(m.max, m.inMs + len);
    if (outMs - m.inMs < 500) {
      i++;
      continue;
    }
    const id = newId("clip");
    const effects = params.montage.zoomPulse ? [{ type: "zoomPulse" as const, params: { amount: 0.06, bpm } }] : [];
    rec.apply({
      op: "addVideoClip",
      clip: { id, assetId: m.assetId, startMs: cursor, inMs: m.inMs, outMs, volume: 0.2, effects, transform: { scale: 1, x: 0, y: 0, rotate: 0 }, reason: `${(len / 1000).toFixed(1)} s beat cut (${bpm} bpm)${accelerate ? ", faster towards the end" : ""}` },
    });
    if (i > 0) {
      const type: TransitionType = params.montage.flashOnSection && i % 8 === 0 ? "flash" : i % 4 === 0 ? (params.cuts.transitions !== "cut" ? params.cuts.transitions : "whip") : "cut";
      if (type !== "cut") rec.apply({ op: "setTransition", clipId: id, side: "in", transition: { type, durationMs: type === "flash" ? 150 : 250 } });
    }
    cursor += outMs - m.inMs;
    i++;
    if (i > count * 2) break;
  }
  stats.jumpCuts = Math.max(0, i - 1);
  const duration = rec.script.output.durationMs;
  rec.apply({ op: "setCaptionsEnabled", enabled: false });

  if (params.graphics.enabled && params.graphics.title && duration >= 4000) {
    rec.apply({ op: "addGraphic", item: { component: "KineticTitle", startMs: 0, durationMs: 2500, props: { text: params.graphics.titleText ?? params.title, align: "center", style: "slam" }, reason: "Title over the opening beats" } });
    stats.graphics.push("title");
  }
  if (params.graphics.enabled && params.graphics.endCard && duration >= 12_000) {
    rec.apply({ op: "addGraphic", item: { component: "EndCard", startMs: duration - 3000, durationMs: 3000, props: { headline: params.graphics.endCardText ?? "Follow for more", handle: params.graphics.handle ?? "" }, reason: "Call to action on the last beats" } });
    stats.graphics.push("end card");
  }
  if (params.music.enabled || !params.music.mood) {
    const asset = await setMusic(rec, media, ctx.projectId, mood, Math.max(params.music.gainDb, -12), false, `${capitalize(mood)} track leads the montage at -12 dB`);
    if (asset) stats.musicMood = mood;
    else stats.notes.push("Music library unavailable: no track added.");
  }
  if (params.sfx.enabled && stats.graphics.includes("title")) {
    const cache = new Map<string, AssetRef | null>();
    if (await addSfx(rec, media, ctx.projectId, "sfx-impact", 0, "Impact under the title", cache)) stats.sfxCount++;
  }
}

/* ------------------------------------------------------------------ */
/* Summary text                                                        */
/* ------------------------------------------------------------------ */

export function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}
export function styleName(id: CaptionStyleId): string {
  return CAPTION_STYLES.find((s) => s.id === id)?.name ?? id;
}
export function moodName(id: MusicMood): string {
  return MUSIC_MOOD_INFO.find((m) => m.id === id)?.name.toLowerCase() ?? id;
}

export function summarizeBuild(stats: BuildStats): string {
  const parts: string[] = [];
  if (stats.mode === "montage") {
    parts.push(`Cut a ${fmtSec(stats.durationMs)} s beat-synced montage from ${stats.clips} moments`);
    if (stats.musicMood) parts.push(`${moodName(stats.musicMood)} track leading`);
  } else {
    if (stats.hookText) parts.push(`Opened with your line "${truncate(tidy(stats.hookText), 50)}"`);
    const cuts: string[] = [];
    if (stats.silencesCut) cuts.push(`${stats.silencesCut} pause${stats.silencesCut === 1 ? "" : "s"}`);
    if (stats.fillersCut) cuts.push(`${stats.fillersCut} filler word${stats.fillersCut === 1 ? "" : "s"}`);
    if (cuts.length) parts.push(`cut ${cuts.join(" and ")}`);
    if (stats.jumpCuts) parts.push(`${stats.jumpCuts} jump cut${stats.jumpCuts === 1 ? "" : "s"}`);
    if (stats.punchIns) parts.push(`${stats.punchIns} punch-in${stats.punchIns === 1 ? "" : "s"}`);
    if (stats.trimmedClips) parts.push(`trimmed ${stats.trimmedClips} weaker bit${stats.trimmedClips === 1 ? "" : "s"} to hit the length`);
    if (stats.captionStyle && stats.captionWords) parts.push(`captions in ${styleName(stats.captionStyle)}`);
    if (stats.musicMood) parts.push(`${moodName(stats.musicMood)} bed under speech`);
  }
  if (stats.sfxCount) parts.push(`${stats.sfxCount} SFX`);
  if (stats.graphics.length) parts.push(stats.graphics.join(" + "));
  if (stats.brollCount) parts.push(`${stats.brollCount} b-roll insert${stats.brollCount === 1 ? "" : "s"}`);
  if (stats.colorPreset !== "none") parts.push(`${stats.colorPreset} grade`);
  const text = parts.join(", ");
  return `${text ? capitalize(text) + "." : "Built the draft."} ${fmtSec(stats.durationMs)} s long${stats.sourceDurationMs ? ` from ${fmtSec(stats.sourceDurationMs)} s of footage` : ""}.${stats.notes.length ? " " + stats.notes.join(" ") : ""}`;
}
