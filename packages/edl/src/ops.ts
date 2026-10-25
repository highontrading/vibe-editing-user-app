/**
 * Edit operations: the single way the AI *and* the timeline UI change a script.
 * Every op is small, serialisable and reversible by keeping the previous version.
 */
import { z } from "zod";
import {
  AudioClipSchema,
  CAPTION_STYLE_IDS,
  CaptionSettingsSchema,
  COLOR_PRESETS,
  EffectSchema,
  GraphicItemSchema,
  TransitionSchema,
  VideoClipSchema,
  WordSchema,
  type EditScript,
  type Track,
  type VideoClip,
} from "./schema";
import { computeDuration, newId } from "./helpers";

const ms = z.number().int().nonnegative();

/** Patch schemas: all-optional and WITHOUT defaults (zod 4 re-applies defaults on .partial()). */
export const CaptionSettingsPatchSchema = z.object({
  fontSize: z.number().positive().optional(),
  position: z.enum(["top", "center", "bottom"]).optional(),
  offset: z.number().min(-1).max(1).optional(),
  color: z.string().optional(),
  highlightColor: z.string().optional(),
  fontFamily: z.string().optional(),
  uppercase: z.boolean().optional(),
  emoji: z.boolean().optional(),
  maxWordsPerLine: z.number().int().positive().optional(),
  mode: z.enum(["word", "line"]).optional(),
  animation: z.enum(["pop", "fade", "slide", "none"]).optional(),
});
export const AudioClipPatchSchema = z.object({
  assetId: z.string().optional(),
  startMs: ms.optional(),
  inMs: ms.optional(),
  outMs: ms.nullable().optional(),
  gainDb: z.number().optional(),
  fadeInMs: ms.optional(),
  fadeOutMs: ms.optional(),
  ducking: z.boolean().optional(),
  loop: z.boolean().optional(),
  reason: z.string().optional(),
  label: z.string().optional(),
});
export const GraphicItemPatchSchema = z.object({
  component: GraphicItemSchema.shape.component.optional(),
  startMs: ms.optional(),
  durationMs: ms.optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().optional(),
});

export const EditOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("addVideoClip"), trackId: z.string().optional(), clip: VideoClipSchema.partial({ id: true }) }),
  z.object({ op: z.literal("trimClip"), clipId: z.string(), inMs: ms.optional(), outMs: ms.optional() }),
  z.object({ op: z.literal("moveClip"), clipId: z.string(), startMs: ms, trackId: z.string().optional() }),
  z.object({ op: z.literal("splitClip"), clipId: z.string(), atMs: ms }),
  z.object({ op: z.literal("deleteClip"), clipId: z.string() }),
  z.object({ op: z.literal("setClipSpeed"), clipId: z.string(), speed: z.number().positive() }),
  z.object({ op: z.literal("setClipVolume"), clipId: z.string(), volume: z.number().min(0).max(2) }),
  z.object({
    op: z.literal("setClipTransform"),
    clipId: z.string(),
    transform: z.object({ scale: z.number().positive().optional(), x: z.number().optional(), y: z.number().optional(), rotate: z.number().optional() }),
  }),
  z.object({ op: z.literal("addEffect"), clipId: z.string(), effect: EffectSchema }),
  z.object({ op: z.literal("removeEffect"), clipId: z.string(), effectType: z.string() }),
  z.object({ op: z.literal("setTransition"), clipId: z.string(), side: z.enum(["in", "out"]), transition: TransitionSchema.nullable() }),
  z.object({ op: z.literal("removeRange"), startMs: ms, endMs: ms }),
  z.object({ op: z.literal("addAudioClip"), role: z.enum(["music", "sfx", "voice", "dialogue"]), clip: AudioClipSchema.partial({ id: true }) }),
  z.object({ op: z.literal("updateAudioClip"), clipId: z.string(), patch: AudioClipPatchSchema }),
  z.object({ op: z.literal("deleteAudioClip"), clipId: z.string() }),
  z.object({ op: z.literal("setTrackMuted"), trackId: z.string(), muted: z.boolean() }),
  z.object({ op: z.literal("setCaptionStyle"), style: z.enum(CAPTION_STYLE_IDS) }),
  z.object({ op: z.literal("setCaptionSettings"), settings: CaptionSettingsPatchSchema }),
  z.object({ op: z.literal("setCaptionsEnabled"), enabled: z.boolean() }),
  z.object({ op: z.literal("setCaptionWords"), words: z.array(WordSchema) }),
  z.object({ op: z.literal("replaceWordText"), wordIndex: z.number().int().nonnegative(), text: z.string() }),
  z.object({ op: z.literal("addGraphic"), item: GraphicItemSchema.partial({ id: true }) }),
  z.object({ op: z.literal("updateGraphic"), itemId: z.string(), patch: GraphicItemPatchSchema }),
  z.object({ op: z.literal("deleteGraphic"), itemId: z.string() }),
  z.object({ op: z.literal("setColorPreset"), preset: z.enum(COLOR_PRESETS) }),
  z.object({ op: z.literal("setGlobal"), patch: z.object({ grain: z.number().min(0).max(1).optional(), vignette: z.number().min(0).max(1).optional() }) }),
  z.object({ op: z.literal("setOutput"), width: z.number().int().positive(), height: z.number().int().positive(), fps: z.number().int().positive().optional() }),
  z.object({ op: z.literal("setMeta"), patch: z.object({ title: z.string().optional(), notes: z.string().optional(), targetLufs: z.number().optional() }) }),
  z.object({ op: z.literal("registerAsset"), asset: z.any() }),
  z.object({ op: z.literal("replaceScript"), script: z.any() }),
]);
export type EditOp = z.input<typeof EditOpSchema>;
export type ParsedEditOp = z.output<typeof EditOpSchema>;

export class OpError extends Error {}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function findVideoClip(script: EditScript, clipId: string): { track: Extract<Track, { kind: "video" }>; index: number; clip: VideoClip } {
  for (const track of script.tracks) {
    if (track.kind !== "video") continue;
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index >= 0) return { track, index, clip: track.clips[index]! };
  }
  throw new OpError(`Video clip not found: ${clipId}`);
}

function findAudioClip(script: EditScript, clipId: string) {
  for (const track of script.tracks) {
    if (track.kind !== "audio") continue;
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index >= 0) return { track, index, clip: track.clips[index]! };
  }
  throw new OpError(`Audio clip not found: ${clipId}`);
}

function mainVideoTrack(script: EditScript) {
  let track = script.tracks.find((t): t is Extract<Track, { kind: "video" }> => t.kind === "video" && t.layer === 0);
  if (!track) {
    track = { id: "v-main", kind: "video", layer: 0, clips: [], name: "Main" };
    script.tracks.unshift(track);
  }
  return track;
}

function captionTrack(script: EditScript) {
  let track = script.tracks.find((t): t is Extract<Track, { kind: "captions" }> => t.kind === "captions");
  if (!track) {
    track = { id: "captions", kind: "captions", style: "bold-pop", settings: CaptionSettingsSchema.parse({}), words: [], enabled: true, name: "Captions" };
    script.tracks.push(track);
  }
  return track;
}

function graphicsTrack(script: EditScript) {
  let track = script.tracks.find((t): t is Extract<Track, { kind: "graphics" }> => t.kind === "graphics");
  if (!track) {
    track = { id: "gfx", kind: "graphics", items: [], name: "Graphics" };
    script.tracks.push(track);
  }
  return track;
}

function audioTrack(script: EditScript, role: "music" | "sfx" | "voice" | "dialogue") {
  let track = script.tracks.find((t): t is Extract<Track, { kind: "audio" }> => t.kind === "audio" && t.role === role);
  if (!track) {
    track = { id: `a-${role}`, kind: "audio", role, clips: [], muted: false, name: role[0]!.toUpperCase() + role.slice(1) };
    script.tracks.push(track);
  }
  return track;
}

/** Duration of a clip on the output timeline. */
export function clipDurationMs(clip: VideoClip): number {
  return Math.max(0, Math.round((clip.outMs - clip.inMs) / (clip.speed || 1)));
}

/** Re-pack the main track so clips are contiguous (no gaps) in order of startMs. */
export function ripple(script: EditScript): EditScript {
  const track = mainVideoTrack(script);
  track.clips.sort((a, b) => a.startMs - b.startMs);
  let cursor = 0;
  for (const clip of track.clips) {
    clip.startMs = cursor;
    cursor += clipDurationMs(clip);
  }
  return script;
}

/**
 * Shift everything that starts at/after `fromMs` by `deltaMs` (captions, graphics,
 * sfx, overlays). Music is not shifted (it is a bed). Used by removeRange/split/delete.
 */
function shiftAfter(script: EditScript, fromMs: number, deltaMs: number, exceptMainTrack = true) {
  for (const track of script.tracks) {
    if (track.kind === "video") {
      if (exceptMainTrack && track.layer === 0) continue;
      for (const c of track.clips) if (c.startMs >= fromMs) c.startMs = Math.max(0, c.startMs + deltaMs);
    } else if (track.kind === "audio") {
      if (track.role === "music") continue;
      for (const c of track.clips) if (c.startMs >= fromMs) c.startMs = Math.max(0, c.startMs + deltaMs);
    } else if (track.kind === "captions") {
      for (const w of track.words) if (w.t >= fromMs) w.t = Math.max(0, w.t + deltaMs);
    } else if (track.kind === "graphics") {
      for (const g of track.items) if (g.startMs >= fromMs) g.startMs = Math.max(0, g.startMs + deltaMs);
    }
  }
}

export function applyOp(input: EditScript, rawOp: EditOp): EditScript {
  const parsed = EditOpSchema.safeParse(rawOp);
  if (!parsed.success) throw new OpError(`Invalid op: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const op = parsed.data;
  const script = clone(input);
  switch (op.op) {
    case "addVideoClip": {
      const track = op.trackId ? script.tracks.find((t) => t.id === op.trackId && t.kind === "video") : mainVideoTrack(script);
      if (!track || track.kind !== "video") throw new OpError(`Video track not found: ${op.trackId}`);
      if (!script.assets[op.clip.assetId]) throw new OpError(`Unknown asset: ${op.clip.assetId}`);
      const clip = VideoClipSchema.parse({ ...op.clip, id: op.clip.id ?? newId("clip") });
      track.clips.push(clip);
      if (track.layer === 0) ripple(script);
      break;
    }
    case "trimClip": {
      const { clip, track } = findVideoClip(script, op.clipId);
      if (op.inMs !== undefined) clip.inMs = op.inMs;
      if (op.outMs !== undefined) clip.outMs = op.outMs;
      if (clip.outMs <= clip.inMs) throw new OpError("outMs must be greater than inMs");
      if (track.layer === 0) ripple(script);
      break;
    }
    case "moveClip": {
      const { clip, track, index } = findVideoClip(script, op.clipId);
      if (op.trackId && op.trackId !== track.id) {
        const target = script.tracks.find((t) => t.id === op.trackId);
        if (!target || target.kind !== "video") throw new OpError(`Video track not found: ${op.trackId}`);
        track.clips.splice(index, 1);
        target.clips.push(clip);
      }
      clip.startMs = op.startMs;
      ripple(script);
      break;
    }
    case "splitClip": {
      const { clip, track, index } = findVideoClip(script, op.clipId);
      const dur = clipDurationMs(clip);
      const rel = op.atMs - clip.startMs;
      if (rel <= 0 || rel >= dur) throw new OpError("Split point must be inside the clip");
      const sourceAt = clip.inMs + Math.round(rel * (clip.speed || 1));
      const second: VideoClip = { ...clone(clip), id: newId("clip"), inMs: sourceAt, startMs: clip.startMs + rel, transitionIn: undefined };
      clip.outMs = sourceAt;
      clip.transitionOut = undefined;
      track.clips.splice(index + 1, 0, second);
      break;
    }
    case "deleteClip": {
      const { clip, track, index } = findVideoClip(script, op.clipId);
      const dur = clipDurationMs(clip);
      track.clips.splice(index, 1);
      if (track.layer === 0) {
        shiftAfter(script, clip.startMs + dur, -dur);
        ripple(script);
      }
      break;
    }
    case "setClipSpeed": {
      const { clip, track } = findVideoClip(script, op.clipId);
      clip.speed = op.speed;
      if (track.layer === 0) ripple(script);
      break;
    }
    case "setClipVolume": {
      findVideoClip(script, op.clipId).clip.volume = op.volume;
      break;
    }
    case "setClipTransform": {
      const { clip } = findVideoClip(script, op.clipId);
      clip.transform = { ...clip.transform, ...op.transform };
      break;
    }
    case "addEffect": {
      const { clip } = findVideoClip(script, op.clipId);
      clip.effects = [...clip.effects.filter((e) => e.type !== op.effect.type), op.effect];
      break;
    }
    case "removeEffect": {
      const { clip } = findVideoClip(script, op.clipId);
      clip.effects = clip.effects.filter((e) => e.type !== op.effectType);
      break;
    }
    case "setTransition": {
      const { clip } = findVideoClip(script, op.clipId);
      if (op.side === "in") clip.transitionIn = op.transition ?? undefined;
      else clip.transitionOut = op.transition ?? undefined;
      break;
    }
    case "removeRange": {
      // Remove [startMs, endMs) from the main track, trimming/splitting clips as needed.
      if (op.endMs <= op.startMs) throw new OpError("endMs must be greater than startMs");
      const track = mainVideoTrack(script);
      const next: VideoClip[] = [];
      for (const clip of track.clips) {
        const cs = clip.startMs;
        const ce = cs + clipDurationMs(clip);
        if (ce <= op.startMs || cs >= op.endMs) {
          next.push(clip);
          continue;
        }
        const speed = clip.speed || 1;
        // left remainder
        if (cs < op.startMs) {
          next.push({ ...clone(clip), outMs: clip.inMs + Math.round((op.startMs - cs) * speed), transitionOut: undefined });
        }
        // right remainder
        if (ce > op.endMs) {
          next.push({ ...clone(clip), id: newId("clip"), inMs: clip.inMs + Math.round((op.endMs - cs) * speed), startMs: op.endMs, transitionIn: undefined });
        }
      }
      track.clips = next;
      // captions/graphics/sfx inside the range are dropped, after it are shifted left
      const delta = -(op.endMs - op.startMs);
      for (const t of script.tracks) {
        if (t.kind === "captions") t.words = t.words.filter((w) => w.t < op.startMs || w.t >= op.endMs);
        if (t.kind === "graphics") t.items = t.items.filter((g) => g.startMs < op.startMs || g.startMs >= op.endMs);
        if (t.kind === "audio" && t.role !== "music") t.clips = t.clips.filter((c) => c.startMs < op.startMs || c.startMs >= op.endMs);
      }
      shiftAfter(script, op.endMs, delta);
      ripple(script);
      break;
    }
    case "addAudioClip": {
      if (!script.assets[op.clip.assetId]) throw new OpError(`Unknown asset: ${op.clip.assetId}`);
      const track = audioTrack(script, op.role);
      track.clips.push(AudioClipSchema.parse({ ...op.clip, id: op.clip.id ?? newId("audio") }));
      break;
    }
    case "updateAudioClip": {
      const { clip } = findAudioClip(script, op.clipId);
      for (const [k, v] of Object.entries(op.patch)) {
        if (v === undefined) continue;
        if (k === "outMs" && v === null) {
          clip.outMs = undefined;
          continue;
        }
        (clip as unknown as Record<string, unknown>)[k] = v;
      }
      if (clip.outMs !== undefined && clip.outMs <= clip.inMs) throw new OpError("outMs must be greater than inMs");
      break;
    }
    case "deleteAudioClip": {
      const { track, index } = findAudioClip(script, op.clipId);
      track.clips.splice(index, 1);
      break;
    }
    case "setTrackMuted": {
      const track = script.tracks.find((t) => t.id === op.trackId);
      if (!track || track.kind !== "audio") throw new OpError(`Audio track not found: ${op.trackId}`);
      track.muted = op.muted;
      break;
    }
    case "setCaptionStyle": {
      captionTrack(script).style = op.style;
      break;
    }
    case "setCaptionSettings": {
      const t = captionTrack(script);
      const patch = Object.fromEntries(Object.entries(op.settings).filter(([, v]) => v !== undefined));
      t.settings = CaptionSettingsSchema.parse({ ...t.settings, ...patch });
      break;
    }
    case "setCaptionsEnabled": {
      captionTrack(script).enabled = op.enabled;
      break;
    }
    case "setCaptionWords": {
      captionTrack(script).words = op.words;
      break;
    }
    case "replaceWordText": {
      const t = captionTrack(script);
      const w = t.words[op.wordIndex];
      if (!w) throw new OpError(`Word index out of range: ${op.wordIndex}`);
      w.text = op.text;
      break;
    }
    case "addGraphic": {
      graphicsTrack(script).items.push(GraphicItemSchema.parse({ ...op.item, id: op.item.id ?? newId("gfx") }));
      break;
    }
    case "updateGraphic": {
      const t = graphicsTrack(script);
      const item = t.items.find((i) => i.id === op.itemId);
      if (!item) throw new OpError(`Graphic not found: ${op.itemId}`);
      const { props, ...rest } = op.patch;
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) (item as unknown as Record<string, unknown>)[k] = v;
      if (props) item.props = { ...item.props, ...props };
      break;
    }
    case "deleteGraphic": {
      const t = graphicsTrack(script);
      t.items = t.items.filter((i) => i.id !== op.itemId);
      break;
    }
    case "setColorPreset": {
      script.global.colorPreset = op.preset;
      break;
    }
    case "setGlobal": {
      Object.assign(script.global, op.patch);
      break;
    }
    case "setOutput": {
      script.output.width = op.width;
      script.output.height = op.height;
      if (op.fps) script.output.fps = op.fps;
      break;
    }
    case "setMeta": {
      script.meta = { ...script.meta, ...op.patch };
      break;
    }
    case "registerAsset": {
      const asset = op.asset as EditScript["assets"][string];
      script.assets[asset.id] = asset;
      break;
    }
    case "replaceScript": {
      return computeDuration(op.script as EditScript);
    }
  }
  return computeDuration(script);
}

export function applyOps(script: EditScript, ops: EditOp[]): EditScript {
  return ops.reduce((s, op) => applyOp(s, op), script);
}
