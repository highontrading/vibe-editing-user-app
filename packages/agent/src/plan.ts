/**
 * createPlan: brief + footage → plain-words Plan the user approves.
 * Claude mode: Opus with structured output (PlanOutputSchema), effort high.
 * MOCK mode: heuristic plan from the brief, recipe defaults and analysis.
 */
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { env } from "@vibe/core";
import { ASPECTS, CAPTION_STYLE_IDS, COLOR_PRESETS, MUSIC_MOODS, PLATFORM_PRESETS, PLATFORMS, PlanSchema, TRANSITION_TYPES, type Aspect, type CaptionStyleId, type ColorPreset, type MusicMood, type Plan, type PlanStep, type Platform } from "@vibe/edl";
import type { PlanResult, ProjectContext } from "./types";
import { buildManifest, fmtClock } from "./manifest";
import { BETAS, FALLBACKS, getClient, stopIssue, systemBlocks, textOf, warn } from "./client";
import { capitalize, hasSpeech, moodName, resolveParams, selectTalkingClips, styleName, trimClipsToTarget, truncate, type BuildStats } from "./builder";
import { COLOR_ALIASES, MOOD_ALIASES, STYLE_ALIASES, findAlias, isCaptionStyle, isColorPreset, isMood, parseAspect, parseDurationMs, parsePlatform, quoted } from "./lexicon";
import { pickHooks } from "./hooks";

/* ------------------------------------------------------------------ */
/* Structured output schema for Claude                                 */
/* ------------------------------------------------------------------ */

const nullable = <T extends z.ZodType>(s: T) => s.nullable().optional();
const StepDetailSchema = z.object({
  text: nullable(z.string()), startMs: nullable(z.number()), endMs: nullable(z.number()), assetId: nullable(z.string()),
  silenceThresholdMs: nullable(z.number()), paddingMs: nullable(z.number()), removeFillers: nullable(z.boolean()), jumpCuts: nullable(z.boolean()), transitions: nullable(z.enum(TRANSITION_TYPES)),
  punchInEvery: nullable(z.number()), punchInScale: nullable(z.number()), speed: nullable(z.number()),
  style: nullable(z.enum(CAPTION_STYLE_IDS)), emoji: nullable(z.boolean()), uppercase: nullable(z.boolean()), maxWordsPerLine: nullable(z.number()), position: nullable(z.enum(["top", "center", "bottom"])), fontSize: nullable(z.number()),
  mood: nullable(z.enum(MUSIC_MOODS)), gainDb: nullable(z.number()), ducking: nullable(z.boolean()),
  onPunchIns: nullable(z.boolean()), titleImpact: nullable(z.boolean()), whooshId: nullable(z.string()),
  title: nullable(z.boolean()), titleText: nullable(z.string()), lowerThird: nullable(z.boolean()), lowerThirdName: nullable(z.string()), lowerThirdTitle: nullable(z.string()), endCard: nullable(z.boolean()), endCardText: nullable(z.string()), progressBar: nullable(z.boolean()), subscribeBubble: nullable(z.boolean()),
  every: nullable(z.number()), durationMs: nullable(z.number()),
  preset: nullable(z.enum(COLOR_PRESETS)), grain: nullable(z.number()), vignette: nullable(z.number()),
  targetDurationMs: nullable(z.number()), subjectTracking: nullable(z.boolean()),
  note: nullable(z.string()),
});
export const PlanOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  aspect: z.enum(ASPECTS),
  platform: z.enum(PLATFORMS),
  targetDurationMs: nullable(z.number()),
  captionStyle: z.enum(CAPTION_STYLE_IDS),
  musicMood: nullable(z.enum(MUSIC_MOODS)),
  colorPreset: z.enum(COLOR_PRESETS),
  steps: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["hook", "cuts", "pacing", "captions", "music", "sfx", "graphics", "broll", "color", "reframe", "length", "other"]),
      text: z.string(),
      enabled: z.boolean(),
      detail: StepDetailSchema,
    }),
  ),
  message: z.string(),
});
type PlanOutput = z.infer<typeof PlanOutputSchema>;

function stripNulls(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
}

export function planFromOutput(out: PlanOutput): Plan {
  const steps = out.steps.map((s, i) => ({ id: s.id || `step-${i + 1}`, kind: s.kind, text: s.text, enabled: s.enabled, detail: stripNulls(s.detail) }));
  return PlanSchema.parse({
    title: out.title.trim() || "Your video",
    summary: out.summary,
    aspect: out.aspect,
    platform: out.platform,
    targetDurationMs: out.targetDurationMs && out.targetDurationMs > 0 ? Math.round(out.targetDurationMs) : undefined,
    captionStyle: out.captionStyle,
    musicMood: out.musicMood ?? undefined,
    colorPreset: out.colorPreset,
    steps,
  });
}

/* ------------------------------------------------------------------ */
/* Public entry                                                        */
/* ------------------------------------------------------------------ */

export async function createPlan(ctx: ProjectContext): Promise<PlanResult> {
  if (env.mockAi) return mockPlan(ctx);
  try {
    const client = getClient();
    const manifest = buildManifest(ctx);
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      { type: "text", text: manifest, cache_control: { type: "ephemeral" } },
      { type: "text", text: `BRIEF FROM THE USER:\n${ctx.brief.trim() || "(no brief: use the recipe and the footage)"}\n\nWrite the plan now.` },
    ];
    const response = await client.beta.messages.parse({
      model: env.agentModel,
      max_tokens: 8000,
      betas: BETAS,
      fallbacks: FALLBACKS,
      system: systemBlocks(ctx, "plan"),
      output_config: { effort: "high", format: betaZodOutputFormat(PlanOutputSchema) },
      messages: [{ role: "user", content }],
    });
    const issue = stopIssue(response);
    if (issue || !response.parsed_output) {
      warn("plan", issue ?? "no structured output");
      const fallback = mockPlan(ctx);
      return { ...fallback, message: `${issue ?? "I could not finish the plan with the model."} Here is a plan from the footage analysis instead. ${fallback.message}` };
    }
    const plan = planFromOutput(response.parsed_output);
    if (plan.steps.length < 6) {
      // Top up with heuristic steps so the builder always has a complete plan.
      const heuristic = mockPlan(ctx).plan;
      for (const s of heuristic.steps) if (!plan.steps.some((p) => p.kind === s.kind) && plan.steps.length < 10) plan.steps.push(s);
    }
    return { plan, message: response.parsed_output.message || textOf(response) || "Here is the plan. Toggle anything off or tell me what to change, then approve." };
  } catch (e) {
    warn("plan", e);
    const fallback = mockPlan(ctx);
    return { ...fallback, message: `I could not reach the model, so here is a plan from the footage analysis. ${fallback.message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Heuristic plan (MOCK mode and fallback)                             */
/* ------------------------------------------------------------------ */

interface BriefHints {
  musicMood?: MusicMood;
  noMusic: boolean;
  captionStyle?: CaptionStyleId;
  noCaptions: boolean;
  colorPreset?: ColorPreset;
  targetMs?: number;
  platform?: Platform;
  aspect?: Aspect;
  title?: string;
  wantsBroll: boolean;
  noBroll: boolean;
  noSfx: boolean;
  noTitle: boolean;
  noEndCard: boolean;
  noPunchIns: boolean;
  keepFillers: boolean;
  progressBar: boolean;
  emoji: boolean;
}

export function parseBrief(brief: string): BriefHints {
  const l = brief.toLowerCase();
  const noMusic = /\b(no|without|don'?t (add|use|want)|remove|skip)\b[^.]{0,20}\bmusic\b/.test(l);
  const noCaptions = /\b(no|without|don'?t (add|use|want)|skip)\b[^.]{0,20}\b(captions?|subtitles?)\b/.test(l);
  const musicMatch = l.match(/\b(music|track|bed|soundtrack|beat)\b[^.]{0,40}/g)?.join(" ") ?? "";
  return {
    musicMood: noMusic ? undefined : findAlias(musicMatch || l, MOOD_ALIASES, MUSIC_MOODS) ?? (musicMatch ? findAlias(l, MOOD_ALIASES, MUSIC_MOODS) : undefined),
    noMusic,
    captionStyle: findAlias(l.match(/\b(captions?|subtitles?|text)\b[^.]{0,40}/g)?.join(" ") ?? "", STYLE_ALIASES, CAPTION_STYLE_IDS) ?? (/\bhormozi\b/.test(l) ? "hormozi" : undefined),
    noCaptions,
    colorPreset: findAlias(l.match(/\b(grade|colou?r|look|tone|lut|feel|vibe)\b[^.]{0,40}/g)?.join(" ") ?? "", COLOR_ALIASES, COLOR_PRESETS),
    targetMs: parseDurationMs(l),
    platform: parsePlatform(l),
    aspect: parseAspect(l),
    title: quoted(brief),
    wantsBroll: /b[- ]?roll|stock footage/.test(l) && !/\bno b[- ]?roll\b/.test(l),
    noBroll: /\b(no|without|skip)\b[^.]{0,12}\bb[- ]?roll\b/.test(l),
    noSfx: /\b(no|without|skip)\b[^.]{0,12}\b(sfx|sound effects?|whoosh(es)?)\b/.test(l),
    noTitle: /\b(no|without|skip)\b[^.]{0,12}\b(title|titles)\b/.test(l),
    noEndCard: /\b(no|without|skip)\b[^.]{0,12}\b(end ?card|cta|outro)\b/.test(l),
    noPunchIns: /\b(no|without|skip)\b[^.]{0,12}\b(zoom|zooms|punch[- ]?ins?)\b/.test(l),
    keepFillers: /\bkeep\b[^.]{0,20}\b(fillers?|ums?|natural)\b/.test(l) || /\b(conversational|podcast|raw)\b/.test(l),
    progressBar: /progress bar/.test(l),
    emoji: /\bemoji/.test(l) && !/\bno emoji/.test(l),
  };
}

function prefBool(prefs: Record<string, unknown> | undefined, keys: string[]): boolean | undefined {
  for (const k of keys) if (prefs && typeof prefs[k] === "boolean") return prefs[k] as boolean;
  return undefined;
}

function titleFromBrief(ctx: ProjectContext, hints: BriefHints, hookText?: string): string {
  if (hints.title) return truncate(hints.title, 40);
  const brief = ctx.brief.replace(/\s+/g, " ").trim();
  // Strip instruction verbs: "make a video about X" → "X"
  const about = brief.match(/\b(?:about|on|explaining|showing|covering)\s+(.{4,60}?)(?:[.,;]|$| for | in | with | that )/i)?.[1];
  const candidate = about ?? (hookText && hookText.split(/\s+/).length <= 9 ? hookText : undefined) ?? brief.split(/[.!?]/)[0] ?? "";
  const words = candidate.replace(/^(please|can you|could you|i want|i need|make|create|edit|turn|cut)\b.*?\b(video|clip|reel|short)\b\s*(about|on|of)?/i, "").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const text = words.join(" ").replace(/[.,;:!?]+$/, "");
  const cleaned = text ? capitalize(text) : ctx.recipe?.title ?? "Your video";
  return truncate(cleaned, 40);
}

export function mockPlan(ctx: ProjectContext): PlanResult {
  const hints = parseBrief(ctx.brief ?? "");
  const rd = (ctx.recipe?.defaults ?? {}) as Record<string, unknown>;
  const prefs = ctx.preferences ?? {};
  const platform: Platform = hints.platform ?? (isPlatformId(ctx.platform) ? ctx.platform : isPlatformId(rd.platform) ? rd.platform : "custom");
  const aspect: Aspect = hints.aspect ?? ((ASPECTS as readonly string[]).includes(ctx.aspect) ? (ctx.aspect as Aspect) : PLATFORM_PRESETS[platform].aspect);
  const assets = ctx.assets.filter((a) => a.ref.kind === "video" && (a.analysis?.durationMs ?? a.ref.durationMs ?? 0) > 0);
  const talking = assets.some(hasSpeech);
  const sourceMs = assets.reduce((n, a) => n + (a.analysis?.durationMs ?? a.ref.durationMs ?? 0), 0);

  const wantMusic = !hints.noMusic && prefBool(prefs, ["music", "addMusic"]) !== false && prefBool(prefs, ["noMusic", "neverAddMusic"]) !== true;
  const musicMood: MusicMood | undefined = wantMusic
    ? hints.musicMood ?? (isMood(prefs.musicMood) ? prefs.musicMood : undefined) ?? (isMood(ctx.brand?.defaultMusicMood) ? ctx.brand!.defaultMusicMood! : undefined) ?? (isMood(rd.musicMood) ? rd.musicMood : talking ? "lofi" : "energetic")
    : undefined;
  const captionStyle: CaptionStyleId = hints.captionStyle ?? (isCaptionStyle(prefs.captionStyle) ? prefs.captionStyle : undefined) ?? (isCaptionStyle(ctx.brand?.defaultCaptionStyle) ? ctx.brand!.defaultCaptionStyle! : undefined) ?? (isCaptionStyle(rd.captionStyle) ? rd.captionStyle : platform === "linkedin" || platform === "youtube" ? "clean-minimal" : "bold-pop");
  const colorPreset: ColorPreset = hints.colorPreset ?? (isColorPreset(rd.colorPreset) ? rd.colorPreset : talking ? "clean" : "vibrant");
  const removeFillers = prefBool(prefs, ["alwaysRemoveFillers", "removeFillers"]) ?? (hints.keepFillers ? false : typeof rd.removeFillers === "boolean" ? rd.removeFillers : true);
  const captionsOn = !hints.noCaptions && prefBool(prefs, ["captionsAlwaysOn", "captions"]) !== false;
  const platformMax = PLATFORM_PRESETS[platform].maxDurationMs;
  const explicitTarget = hints.targetMs ?? ctx.targetDurationMs ?? (typeof rd.targetDurationMs === "number" ? rd.targetDurationMs : undefined);

  // Dry-run the cut selection to get real numbers for the step texts.
  const hookOn = prefBool(prefs, ["hookFirst"]) ?? (typeof rd.hookFirst === "boolean" ? rd.hookFirst : true);
  const punchInsOn = !hints.noPunchIns && (typeof rd.punchIns === "boolean" ? rd.punchIns : true);
  const silenceThresholdMs = typeof rd.silenceThresholdMs === "number" ? rd.silenceThresholdMs : 500;
  const provisional: Plan = PlanSchema.parse({
    title: "draft", summary: "", aspect, platform, captionStyle, musicMood, colorPreset,
    steps: [
      { id: "hook", kind: "hook", text: "", enabled: hookOn && talking, detail: {} },
      { id: "cuts", kind: "cuts", text: "", enabled: talking, detail: { silenceThresholdMs, removeFillers, jumpCuts: true } },
    ],
  });
  const stats: BuildStats = { mode: talking ? "talking" : "montage", silencesCut: 0, fillersCut: 0, jumpCuts: 0, punchIns: 0, captionWords: 0, sfxCount: 0, graphics: [], brollCount: 0, colorPreset, durationMs: 0, sourceDurationMs: sourceMs, trimmedClips: 0, clips: 0, notes: [] };
  let keptMs = sourceMs;
  if (talking) {
    const params = resolveParams(ctx, provisional);
    let clips = selectTalkingClips(assets, params, stats);
    keptMs = clips.reduce((n, c) => n + (c.outMs - c.inMs), 0);
    if (explicitTarget) {
      clips = trimClipsToTarget(assets, clips, Math.min(explicitTarget, platformMax), { ...stats });
      keptMs = clips.reduce((n, c) => n + (c.outMs - c.inMs), 0);
    }
  }
  const targetDurationMs = Math.round(Math.min(platformMax, explicitTarget ?? (talking ? keptMs : Math.min(30_000, Math.max(8000, sourceMs)))));
  const hook = stats.hookText ? { text: stats.hookText, startMs: stats.hookSourceMs } : undefined;
  const firstHook = assets.map((a) => (a.analysis ? (a.analysis.hooks[0] ?? pickHooks(a.analysis)[0]) : undefined)).find(Boolean);
  const title = titleFromBrief(ctx, hints, hook?.text ?? firstHook?.text);
  const handle = ctx.brand?.handle ?? undefined;
  const transitions = typeof rd.transitions === "string" && (TRANSITION_TYPES as readonly string[]).includes(rd.transitions) ? (rd.transitions as string) : "cut";
  const brollEvery = typeof rd.brollEvery === "number" ? rd.brollEvery : 12_000;
  const brollOn = !hints.noBroll && (hints.wantsBroll || (typeof rd.broll === "boolean" ? rd.broll : talking && targetDurationMs > 25_000));
  const estBroll = brollOn ? Math.max(1, Math.floor((targetDurationMs - 4000) / brollEvery)) : 0;
  const estPunch = punchInsOn && talking ? Math.max(1, Math.floor(targetDurationMs / 10_000)) : 0;

  const steps: PlanStep[] = [];
  const push = (kind: PlanStep["kind"], text: string, detail: Record<string, unknown>, enabled = true) => steps.push({ id: kind === "other" ? `other-${steps.length + 1}` : kind, kind, text, enabled, detail });

  if (talking) {
    if (hook) push("hook", `Open with your line "${truncate(hook.text, 60)}" (${fmtClock(hook.startMs ?? 0)}) so the first two seconds grab.`, { text: hook.text, startMs: hook.startMs, assetId: assets[0]?.ref.id }, hookOn);
    else if (firstHook) push("hook", `Open with "${truncate(firstHook.text, 60)}" (${fmtClock(firstHook.startMs)}).`, { text: firstHook.text, startMs: firstHook.startMs, endMs: firstHook.endMs }, hookOn);
    else push("hook", "Open on the first sentence (no stronger hook line found in the transcript).", {}, false);
    const cutBits: string[] = [];
    if (stats.silencesCut) cutBits.push(`${stats.silencesCut} pause${stats.silencesCut === 1 ? "" : "s"} longer than ${(silenceThresholdMs / 1000).toFixed(1)} s`);
    if (removeFillers && stats.fillersCut) cutBits.push(`${stats.fillersCut} filler word${stats.fillersCut === 1 ? "" : "s"}`);
    push("cuts", `Cut ${cutBits.length ? cutBits.join(" and ") : "dead air"}, keeping 120 ms of breathing room, and jump cut on ${stats.jumpCuts} sentence break${stats.jumpCuts === 1 ? "" : "s"}${transitions !== "cut" ? ` with ${transitions} transitions on scene changes` : ""}.`, { silenceThresholdMs, paddingMs: 120, removeFillers, jumpCuts: true, transitions });
    push("pacing", `Alternate full frame and a 112% punch-in every ~10 s (about ${estPunch} punch-in${estPunch === 1 ? "" : "s"}) to keep the eye moving.`, { punchInEvery: 10_000, punchInScale: 1.12 }, punchInsOn);
    push("captions", `${styleName(captionStyle)} captions, word by word, 3 words per group, keywords and numbers highlighted${hints.emoji || captionStyle === "emoji-pop" ? ", with emoji on key words" : ""}.`, { style: captionStyle, emoji: hints.emoji || captionStyle === "emoji-pop", maxWordsPerLine: 3 }, captionsOn);
  } else {
    push("hook", `Open on the most dynamic shot with a title card.`, {}, true);
    push("cuts", `Beat-synced cuts of 1.5 to 3 s following the ${musicMood ? moodName(musicMood) : "energetic"} track, faster towards the end, with whip pans between sections and a flash on the drop.`, { transitions: transitions === "cut" ? "whip" : transitions, jumpCuts: false });
    push("pacing", "Zoom pulse on every beat clip for energy.", { punchInEvery: 4000, punchInScale: 1.08 });
    push("captions", "No captions (no speech detected).", { style: captionStyle }, false);
  }
  if (musicMood) push("music", talking ? `${capitalize(moodName(musicMood))} music under speech at -18 dB, ducked so every word stays clear.` : `${capitalize(moodName(musicMood))} track leading at -12 dB.`, { mood: musicMood, gainDb: talking ? -18 : -12, ducking: talking });
  else push("music", "No music (as requested).", {}, false);
  push("sfx", talking ? `A whoosh on each punch-in and an impact under the title: ${estPunch + 1} SFX, nothing on every cut.` : "Impact under the title, no other SFX.", { onPunchIns: true, titleImpact: true, whooshId: "sfx-whoosh-1" }, !hints.noSfx);
  const gfxBits = [`title card "${title}" at 0:00`];
  if (handle) gfxBits.push(`lower third ${handle} early on`);
  if (targetDurationMs >= 12_000 && !hints.noEndCard) gfxBits.push(`end card${handle ? ` with ${handle}` : ""} in the last 3 s`);
  if (hints.progressBar || rd.progressBar) gfxBits.push("progress bar across the top");
  push("graphics", `Graphics: ${gfxBits.join(", ")}.`, { title: !hints.noTitle, titleText: title, lowerThird: !!handle, lowerThirdName: handle, endCard: targetDurationMs >= 12_000 && !hints.noEndCard, endCardText: "Follow for more", progressBar: !!(hints.progressBar || rd.progressBar) });
  if (talking) push("broll", `Stock b-roll matched to what you say over talking stretches longer than ${Math.round(brollEvery / 1000)} s (about ${estBroll} insert${estBroll === 1 ? "" : "s"} of 3.5 s).`, { every: brollEvery, durationMs: 3500 }, brollOn);
  push("color", colorPreset === "none" ? "Leave the colour untouched." : `${capitalize(colorPreset.replace("-", " "))} colour preset${colorPreset === "warm-film" ? " with light grain" : colorPreset === "moody" ? " with a subtle vignette" : ""}.`, { preset: colorPreset }, colorPreset !== "none");
  push("length", `Aim for about ${fmtClock(targetDurationMs)} in ${aspect}${platform !== "custom" ? ` for ${PLATFORM_PRESETS[platform].label}` : ""}${sourceMs ? ` (from ${fmtClock(sourceMs)} of footage)` : ""}.`, { targetDurationMs });

  const plan = PlanSchema.parse({
    title,
    summary: talking
      ? `A ${fmtClock(targetDurationMs)} ${aspect} cut that opens on your strongest line, removes dead air and fillers, and keeps attention with punch-ins, ${styleName(captionStyle)} captions${musicMood ? ` and a ${moodName(musicMood)} bed` : ""}.`
      : `A ${fmtClock(targetDurationMs)} ${aspect} beat-synced montage${musicMood ? ` to a ${moodName(musicMood)} track` : ""} with a title card and ${colorPreset} colour.`,
    aspect, platform, targetDurationMs, captionStyle, musicMood, colorPreset, steps: steps.slice(0, 10),
  });
  const message = talking
    ? `Here's my plan for "${title}". I'll ${hook ? `open on "${truncate(hook.text, 40)}", ` : ""}cut ${stats.silencesCut + (removeFillers ? stats.fillersCut : 0)} pauses and fillers, and land around ${fmtClock(targetDurationMs)}. Toggle anything off or tell me what to change, then approve and I'll build the draft.`
    : `Here's my plan for "${title}": a ${fmtClock(targetDurationMs)} beat-synced montage${musicMood ? ` to ${moodName(musicMood)} music` : ""}. Toggle anything off or tell me what to change, then approve and I'll build it.`;
  return { plan, message };
}

function isPlatformId(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}
