/**
 * The Edit Script (EDL) is the contract between the AI editor, the timeline UI
 * and the renderer. The AI never touches pixels: it reads a footage manifest
 * and writes/changes this document. The renderer turns it into video.
 *
 * All times are milliseconds on the output timeline unless named `inMs`/`outMs`
 * (source media time).
 */
import { z } from "zod";

export const CAPTION_STYLE_IDS = [
  "bold-pop",
  "clean-minimal",
  "hormozi",
  "karaoke",
  "typewriter",
  "outline",
  "glow",
  "boxed",
  "lower-third",
  "two-line",
  "emoji-pop",
  "handwritten",
] as const;
export type CaptionStyleId = (typeof CAPTION_STYLE_IDS)[number];

export const TRANSITION_TYPES = [
  "cut",
  "crossfade",
  "whip",
  "zoom",
  "slide",
  "flash",
  "glitch",
  "dip-to-black",
] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const EFFECT_TYPES = [
  "colorGrade",
  "grain",
  "vignette",
  "blur",
  "lightLeak",
  "shake",
  "zoomPulse",
  "speedRamp",
] as const;
export type EffectType = (typeof EFFECT_TYPES)[number];

export const COLOR_PRESETS = ["none", "warm-film", "clean", "moody", "vibrant", "bw", "teal-orange"] as const;
export type ColorPreset = (typeof COLOR_PRESETS)[number];

/** Graphics components implemented in @vibe/compositions. Keep in sync with COMPONENT_CATALOG. */
export const GRAPHIC_COMPONENT_IDS = [
  "KineticTitle",
  "LowerThird",
  "EndCard",
  "ProgressBar",
  "SubscribeBubble",
  "PointerHighlight",
  "TextCallout",
  "ImageOverlay",
  "LogoBug",
  "ChapterCard",
  "CountdownTimer",
  "SplitScreen",
] as const;
export type GraphicComponentId = (typeof GRAPHIC_COMPONENT_IDS)[number];

export const MUSIC_MOODS = [
  "upbeat",
  "lofi",
  "cinematic",
  "chill",
  "energetic",
  "emotional",
  "corporate",
  "funky",
  "dark",
  "acoustic",
] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export const PLATFORMS = ["tiktok", "reels", "shorts", "youtube", "linkedin", "x", "custom"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const ASPECTS = ["9:16", "16:9", "1:1", "4:5"] as const;
export type Aspect = (typeof ASPECTS)[number];

const ms = z.number().int().nonnegative();

export const AssetRefSchema = z.object({
  id: z.string(),
  kind: z.enum(["video", "audio", "image"]),
  /** Resolvable URL at render/preview time (signed URL or local path). */
  url: z.string(),
  name: z.string().optional(),
  durationMs: ms.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Where it came from: upload, stock, generated, brand, music-library */
  source: z.enum(["upload", "stock", "generated", "brand", "library"]).default("upload"),
  attribution: z.string().optional(),
});
export type AssetRef = z.infer<typeof AssetRefSchema>;

export const TransformSchema = z.object({
  scale: z.number().positive().default(1),
  x: z.number().default(0),
  y: z.number().default(0),
  rotate: z.number().default(0),
  /** Crop in source pixels, applied before transform. */
  crop: z
    .object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() })
    .optional(),
});
export type Transform = z.infer<typeof TransformSchema>;

export const TransitionSchema = z.object({
  type: z.enum(TRANSITION_TYPES),
  durationMs: ms.default(300),
});
export type Transition = z.infer<typeof TransitionSchema>;

export const EffectSchema = z.object({
  type: z.enum(EFFECT_TYPES),
  /** Effect-specific params: colorGrade.preset, grain.amount(0-1), blur.px, shake.intensity(0-1), zoomPulse.amount, speedRamp.{from,to} */
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  startMs: ms.optional(),
  endMs: ms.optional(),
});
export type Effect = z.infer<typeof EffectSchema>;

export const VideoClipSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  /** Position on the output timeline. */
  startMs: ms,
  /** Source in/out points. */
  inMs: ms,
  outMs: ms,
  speed: z.number().positive().default(1),
  volume: z.number().min(0).max(2).default(1),
  transform: TransformSchema.prefault({}),
  effects: z.array(EffectSchema).default([]),
  transitionIn: TransitionSchema.optional(),
  transitionOut: TransitionSchema.optional(),
  /** Why the AI made this decision; shown to the user on click. */
  reason: z.string().optional(),
  label: z.string().optional(),
});
export type VideoClip = z.infer<typeof VideoClipSchema>;

export const AudioClipSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  startMs: ms,
  inMs: ms.default(0),
  outMs: ms.optional(),
  gainDb: z.number().default(0),
  fadeInMs: ms.default(0),
  fadeOutMs: ms.default(0),
  /** Lower this clip under speech. */
  ducking: z.boolean().default(false),
  loop: z.boolean().default(false),
  reason: z.string().optional(),
  label: z.string().optional(),
});
export type AudioClip = z.infer<typeof AudioClipSchema>;

export const WordSchema = z.object({
  /** start on the output timeline */
  t: ms,
  /** duration */
  d: ms,
  text: z.string(),
  emphasis: z.boolean().optional(),
  emoji: z.string().optional(),
  speaker: z.string().optional(),
});
export type Word = z.infer<typeof WordSchema>;

export const CaptionSettingsSchema = z.object({
  fontSize: z.number().positive().default(64),
  position: z.enum(["top", "center", "bottom"]).default("bottom"),
  /** 0-1 vertical offset fine tune within the position band */
  offset: z.number().min(-1).max(1).default(0),
  color: z.string().default("#FFFFFF"),
  highlightColor: z.string().default("#FFD400"),
  fontFamily: z.string().optional(),
  uppercase: z.boolean().default(false),
  emoji: z.boolean().default(false),
  maxWordsPerLine: z.number().int().positive().default(4),
  mode: z.enum(["word", "line"]).default("word"),
  animation: z.enum(["pop", "fade", "slide", "none"]).default("pop"),
});
export type CaptionSettings = z.infer<typeof CaptionSettingsSchema>;

export const GraphicItemSchema = z.object({
  id: z.string(),
  component: z.enum(GRAPHIC_COMPONENT_IDS),
  startMs: ms,
  durationMs: ms,
  props: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().optional(),
});
export type GraphicItem = z.infer<typeof GraphicItemSchema>;

export const VideoTrackSchema = z.object({
  id: z.string(),
  kind: z.literal("video"),
  /** 0 = main footage, 1+ = b-roll / overlays drawn on top */
  layer: z.number().int().nonnegative().default(0),
  clips: z.array(VideoClipSchema),
  name: z.string().optional(),
});
export const AudioTrackSchema = z.object({
  id: z.string(),
  kind: z.literal("audio"),
  role: z.enum(["music", "sfx", "voice", "dialogue"]),
  clips: z.array(AudioClipSchema),
  muted: z.boolean().default(false),
  name: z.string().optional(),
});
export const CaptionTrackSchema = z.object({
  id: z.string(),
  kind: z.literal("captions"),
  style: z.enum(CAPTION_STYLE_IDS).default("bold-pop"),
  settings: CaptionSettingsSchema.prefault({}),
  words: z.array(WordSchema),
  enabled: z.boolean().default(true),
  name: z.string().optional(),
});
export const GraphicsTrackSchema = z.object({
  id: z.string(),
  kind: z.literal("graphics"),
  items: z.array(GraphicItemSchema),
  name: z.string().optional(),
});

export const TrackSchema = z.discriminatedUnion("kind", [
  VideoTrackSchema,
  AudioTrackSchema,
  CaptionTrackSchema,
  GraphicsTrackSchema,
]);
export type Track = z.infer<typeof TrackSchema>;
export type VideoTrack = z.infer<typeof VideoTrackSchema>;
export type AudioTrack = z.infer<typeof AudioTrackSchema>;
export type CaptionTrack = z.infer<typeof CaptionTrackSchema>;
export type GraphicsTrack = z.infer<typeof GraphicsTrackSchema>;

export const OutputSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive().default(30),
  /** Derived; recomputed by computeDuration(). */
  durationMs: ms.default(0),
  background: z.string().default("#000000"),
});
export type Output = z.infer<typeof OutputSchema>;

export const GlobalEffectsSchema = z.object({
  colorPreset: z.enum(COLOR_PRESETS).default("none"),
  grain: z.number().min(0).max(1).default(0),
  vignette: z.number().min(0).max(1).default(0),
});

export const EditScriptSchema = z.object({
  version: z.literal(1),
  output: OutputSchema,
  assets: z.record(z.string(), AssetRefSchema),
  tracks: z.array(TrackSchema),
  global: GlobalEffectsSchema.prefault({}),
  meta: z
    .object({
      title: z.string().optional(),
      platform: z.enum(PLATFORMS).optional(),
      aspect: z.enum(ASPECTS).optional(),
      recipeId: z.string().optional(),
      notes: z.string().optional(),
      /** Loudness target in LUFS for the final mix. */
      targetLufs: z.number().default(-14),
    })
    .prefault({}),
});
export type EditScript = z.infer<typeof EditScriptSchema>;

/* ------------------------------------------------------------------ */
/* Footage manifest: what the AI reads about each uploaded asset.       */
/* ------------------------------------------------------------------ */

export const TranscriptWordSchema = z.object({
  t: ms,
  d: ms,
  text: z.string(),
  speaker: z.string().optional(),
  confidence: z.number().optional(),
});
export const TranscriptSegmentSchema = z.object({
  startMs: ms,
  endMs: ms,
  text: z.string(),
  speaker: z.string().optional(),
});
export const ShotSchema = z.object({
  startMs: ms,
  endMs: ms,
  /** Natural-language description from vision, e.g. "medium shot, woman at desk talking" */
  description: z.string().optional(),
  /** Where the main subject is: used for auto-reframe. 0 = left edge, 1 = right edge. */
  subjectX: z.number().min(0).max(1).optional(),
  subjectY: z.number().min(0).max(1).optional(),
  keyframeUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export const AssetAnalysisSchema = z.object({
  durationMs: ms,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().positive().optional(),
  hasAudio: z.boolean().default(true),
  language: z.string().optional(),
  transcript: z
    .object({
      words: z.array(TranscriptWordSchema),
      segments: z.array(TranscriptSegmentSchema),
      speakers: z.array(z.string()).default([]),
      text: z.string().default(""),
    })
    .optional(),
  shots: z.array(ShotSchema).default([]),
  audio: z
    .object({
      silences: z.array(z.object({ startMs: ms, endMs: ms })).default([]),
      loudnessLufs: z.number().optional(),
      hasMusic: z.boolean().optional(),
    })
    .prefault({}),
  quality: z
    .object({
      fillers: z.array(z.object({ startMs: ms, endMs: ms, text: z.string() })).default([]),
      shaky: z.array(z.object({ startMs: ms, endMs: ms })).default([]),
      dark: z.array(z.object({ startMs: ms, endMs: ms })).default([]),
    })
    .prefault({}),
  /** One-paragraph summary of the asset for the agent and the UI. */
  summary: z.string().optional(),
  /** Best candidate hook lines, chosen during analysis. */
  hooks: z.array(z.object({ startMs: ms, endMs: ms, text: z.string(), score: z.number() })).default([]),
});
export type AssetAnalysis = z.infer<typeof AssetAnalysisSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;

/* ------------------------------------------------------------------ */
/* Plan: the plain-words edit plan the user approves before building.  */
/* ------------------------------------------------------------------ */

export const PlanStepSchema = z.object({
  id: z.string(),
  /** Category used for icons/grouping in the UI */
  kind: z.enum(["hook", "cuts", "pacing", "captions", "music", "sfx", "graphics", "broll", "color", "reframe", "length", "other"]),
  /** Plain-words description shown to the user */
  text: z.string(),
  enabled: z.boolean().default(true),
  /** Optional structured detail the builder uses */
  detail: z.record(z.string(), z.unknown()).default({}),
});
export const PlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  aspect: z.enum(ASPECTS),
  platform: z.enum(PLATFORMS).default("custom"),
  targetDurationMs: ms.optional(),
  captionStyle: z.enum(CAPTION_STYLE_IDS).default("bold-pop"),
  musicMood: z.enum(MUSIC_MOODS).optional(),
  colorPreset: z.enum(COLOR_PRESETS).default("none"),
  steps: z.array(PlanStepSchema),
});
export type Plan = z.infer<typeof PlanSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
