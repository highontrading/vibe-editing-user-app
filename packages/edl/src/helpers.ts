import { EditScriptSchema, type Aspect, type EditScript, type Platform, type Track, type VideoClip } from "./schema";

let counter = 0;
export function newId(prefix = "id"): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export const ASPECT_SIZES: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export const PLATFORM_PRESETS: Record<Platform, { aspect: Aspect; maxDurationMs: number; label: string; safeTop: number; safeBottom: number }> = {
  tiktok: { aspect: "9:16", maxDurationMs: 180_000, label: "TikTok", safeTop: 0.12, safeBottom: 0.22 },
  reels: { aspect: "9:16", maxDurationMs: 90_000, label: "Instagram Reels", safeTop: 0.12, safeBottom: 0.2 },
  shorts: { aspect: "9:16", maxDurationMs: 60_000, label: "YouTube Shorts", safeTop: 0.1, safeBottom: 0.18 },
  youtube: { aspect: "16:9", maxDurationMs: 3_600_000, label: "YouTube", safeTop: 0.05, safeBottom: 0.1 },
  linkedin: { aspect: "1:1", maxDurationMs: 600_000, label: "LinkedIn", safeTop: 0.05, safeBottom: 0.08 },
  x: { aspect: "16:9", maxDurationMs: 140_000, label: "X", safeTop: 0.05, safeBottom: 0.08 },
  custom: { aspect: "16:9", maxDurationMs: 3_600_000, label: "Custom", safeTop: 0.05, safeBottom: 0.08 },
};

export function aspectOf(width: number, height: number): Aspect {
  const r = width / height;
  if (Math.abs(r - 9 / 16) < 0.05) return "9:16";
  if (Math.abs(r - 1) < 0.05) return "1:1";
  if (Math.abs(r - 4 / 5) < 0.05) return "4:5";
  return "16:9";
}

export function clipDuration(clip: VideoClip): number {
  return Math.max(0, Math.round((clip.outMs - clip.inMs) / (clip.speed || 1)));
}

/** Recompute output.durationMs from the content. Returns the same object (mutated). */
export function computeDuration(script: EditScript): EditScript {
  let end = 0;
  for (const track of script.tracks) {
    if (track.kind === "video") for (const c of track.clips) end = Math.max(end, c.startMs + clipDuration(c));
    if (track.kind === "graphics") for (const g of track.items) end = Math.max(end, g.startMs + g.durationMs);
    if (track.kind === "audio" && track.role !== "music") {
      for (const c of track.clips) {
        const asset = script.assets[c.assetId];
        const d = c.outMs !== undefined ? c.outMs - c.inMs : asset?.durationMs !== undefined ? asset.durationMs - c.inMs : 0;
        end = Math.max(end, c.startMs + Math.max(0, d));
      }
    }
  }
  script.output.durationMs = end;
  return script;
}

export function emptyScript(opts: { aspect?: Aspect; width?: number; height?: number; fps?: number; platform?: Platform; title?: string } = {}): EditScript {
  const size = opts.width && opts.height ? { width: opts.width, height: opts.height } : ASPECT_SIZES[opts.aspect ?? "9:16"];
  return EditScriptSchema.parse({
    version: 1,
    output: { ...size, fps: opts.fps ?? 30, durationMs: 0 },
    assets: {},
    tracks: [
      { id: "v-main", kind: "video", layer: 0, clips: [], name: "Main" },
      { id: "captions", kind: "captions", style: "bold-pop", words: [], enabled: true, name: "Captions" },
    ],
    meta: { title: opts.title, platform: opts.platform, aspect: opts.aspect ?? aspectOf(size.width, size.height) },
  });
}

export function parseScript(json: unknown): EditScript {
  return computeDuration(EditScriptSchema.parse(json));
}

export function safeParseScript(json: unknown): { ok: true; script: EditScript } | { ok: false; error: string } {
  const r = EditScriptSchema.safeParse(json);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, script: computeDuration(r.data) };
}

export function getTrack<K extends Track["kind"]>(script: EditScript, kind: K, pred?: (t: Extract<Track, { kind: K }>) => boolean) {
  return script.tracks.find((t): t is Extract<Track, { kind: K }> => t.kind === kind && (!pred || pred(t as Extract<Track, { kind: K }>)));
}

export function mainClips(script: EditScript): VideoClip[] {
  return getTrack(script, "video", (t) => t.layer === 0)?.clips ?? [];
}

/** Human-readable summary of what a script contains: used in chat replies and version lists. */
export function scriptSummary(script: EditScript): string {
  const parts: string[] = [];
  const clips = mainClips(script);
  parts.push(`${clips.length} clip${clips.length === 1 ? "" : "s"}`);
  const broll = script.tracks.filter((t) => t.kind === "video" && t.layer > 0).reduce((n, t) => n + (t.kind === "video" ? t.clips.length : 0), 0);
  if (broll) parts.push(`${broll} b-roll`);
  const caps = getTrack(script, "captions");
  if (caps?.enabled && caps.words.length) parts.push(`captions (${caps.style})`);
  for (const t of script.tracks) {
    if (t.kind === "audio" && t.clips.length) parts.push(`${t.clips.length} ${t.role}`);
  }
  const gfx = getTrack(script, "graphics");
  if (gfx?.items.length) parts.push(`${gfx.items.length} graphic${gfx.items.length === 1 ? "" : "s"}`);
  if (script.global.colorPreset !== "none") parts.push(`color: ${script.global.colorPreset}`);
  return `${formatMs(script.output.durationMs)} · ${parts.join(" · ")}`;
}

export function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}:${r.toString().padStart(2, "0")}` : `${r}s`;
}

/** Deterministic quality checks the UI shows as green ticks before export. */
export interface CheckResult {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
  /** whether the builder can auto-fix it */
  fixable?: boolean;
}

export function runChecks(script: EditScript, opts: { targetDurationMs?: number; platform?: Platform } = {}): CheckResult[] {
  const results: CheckResult[] = [];
  const dur = script.output.durationMs;
  const platform = opts.platform ?? script.meta.platform ?? "custom";
  const preset = PLATFORM_PRESETS[platform];

  results.push({ id: "has-content", label: "Has video content", ok: mainClips(script).length > 0, detail: mainClips(script).length ? undefined : "No clips on the main track" });

  if (opts.targetDurationMs) {
    const diff = Math.abs(dur - opts.targetDurationMs) / opts.targetDurationMs;
    results.push({ id: "length", label: `Length close to target (${formatMs(opts.targetDurationMs)})`, ok: diff <= 0.25, detail: `Current ${formatMs(dur)}`, fixable: true });
  }
  results.push({ id: "platform-max", label: `Within ${preset.label} maximum (${formatMs(preset.maxDurationMs)})`, ok: dur <= preset.maxDurationMs, detail: `Current ${formatMs(dur)}`, fixable: true });

  // gaps on main track
  const clips = [...mainClips(script)].sort((a, b) => a.startMs - b.startMs);
  let gap = false;
  let cursor = 0;
  for (const c of clips) {
    if (c.startMs > cursor + 1) gap = true;
    cursor = c.startMs + clipDuration(c);
  }
  results.push({ id: "no-gaps", label: "No black gaps between clips", ok: !gap, fixable: true });

  // captions inside safe zone
  const caps = getTrack(script, "captions");
  if (caps?.enabled && caps.words.length) {
    const pos = caps.settings.position;
    const okZone = pos === "center" || (pos === "bottom" && preset.safeBottom <= 0.25) || pos === "top";
    results.push({ id: "caption-safe", label: "Captions inside platform safe zone", ok: okZone, fixable: true });
    const tooLong = caps.words.some((w) => w.text.length > 24);
    results.push({ id: "caption-words", label: "Caption words readable", ok: !tooLong });
  }

  // audio presence
  const hasDialogue = clips.some((c) => c.volume > 0) || script.tracks.some((t) => t.kind === "audio" && t.role !== "music" && t.clips.length > 0);
  results.push({ id: "has-audio", label: "Has audio", ok: hasDialogue || script.tracks.some((t) => t.kind === "audio" && t.clips.length > 0) });

  // music gain sanity
  const music = getTrack(script, "audio", (t) => t.role === "music");
  if (music?.clips.length) {
    const loud = music.clips.some((c) => c.gainDb > -6);
    results.push({ id: "music-level", label: "Music sits under speech", ok: !loud || !hasDialogue, detail: loud ? "Music louder than -6 dB" : undefined, fixable: true });
  }

  // aspect matches platform
  const aspect = aspectOf(script.output.width, script.output.height);
  results.push({ id: "aspect", label: `Aspect ratio fits ${preset.label}`, ok: platform === "custom" || aspect === preset.aspect, detail: `Output is ${aspect}` });

  return results;
}
