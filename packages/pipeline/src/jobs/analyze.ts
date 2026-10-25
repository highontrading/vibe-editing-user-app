/**
 * analyze {assetId}: transcript, shots (+ keyframes and vision descriptions),
 * audio events, quality flags, hooks and a summary -> Asset.analysis, READY.
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { getStorage, storageKeys } from "@vibe/core";
import { prisma } from "@vibe/db";
import { detectScenes, detectSilences, extractKeyframes, measureLoudness } from "@vibe/media";
import { AssetAnalysisSchema, type AssetAnalysis, type Shot, type TranscriptWord } from "@vibe/edl";
import { describeFrames, pickHooks } from "@vibe/agent";
import { transcribe } from "../providers/transcribe";
import { errorMessage, formatClock, jobScratch, json, log, rmrf } from "../util";
import { localOriginal } from "./ingest";
import { maybeEnqueuePlan, requireString, type JobContext } from "./common";

const MIN_SHOT_MS = 800;
const MAX_SHOTS = 60;
const SCENE_THRESHOLD = 0.35;

type FrameDescription = { timeMs: number; description: string; subjectX: number; subjectY: number; tags: string[] };

/** Shots from cut timestamps; tiny shots are merged into their predecessor. */
export function buildShots(cutsMs: number[], durationMs: number): Shot[] {
  const bounds = [...new Set([0, ...cutsMs.filter((t) => t > 0 && t < durationMs), durationMs])].sort((a, b) => a - b);
  const shots: Shot[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const startMs = bounds[i]!;
    const endMs = bounds[i + 1]!;
    const prev = shots[shots.length - 1];
    if (endMs - startMs < MIN_SHOT_MS && prev) prev.endMs = endMs;
    else shots.push({ startMs, endMs, tags: [] });
  }
  if (shots.length > 1) {
    const last = shots[shots.length - 1]!;
    if (last.endMs - last.startMs < MIN_SHOT_MS) {
      shots[shots.length - 2]!.endMs = last.endMs;
      shots.pop();
    }
  }
  // Keep the keyframe/vision cost bounded for very cutty footage.
  while (shots.length > MAX_SHOTS) {
    let bestIdx = 0;
    let best = Infinity;
    for (let i = 0; i < shots.length - 1; i++) {
      const len = shots[i]!.endMs - shots[i]!.startMs + (shots[i + 1]!.endMs - shots[i + 1]!.startMs);
      if (len < best) {
        best = len;
        bestIdx = i;
      }
    }
    shots[bestIdx]!.endMs = shots[bestIdx + 1]!.endMs;
    shots.splice(bestIdx + 1, 1);
  }
  if (!shots.length) shots.push({ startMs: 0, endMs: durationMs, tags: [] });
  return shots;
}

const FILLER_RE = /^(um+|uh+|uhm+|erm+|hmm+|mm+|ah+|er+)$/i;
export function findFillers(words: TranscriptWord[]): { startMs: number; endMs: number; text: string }[] {
  const out: { startMs: number; endMs: number; text: string }[] = [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z']/g, "");
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const text = norm(w.text);
    const next = words[i + 1];
    const gapAfter = next ? next.t - (w.t + w.d) : 1000;
    if (FILLER_RE.test(text)) {
      out.push({ startMs: w.t, endMs: w.t + w.d, text: w.text });
      continue;
    }
    // "like" as a filler: followed by a pause, or wrapped in commas.
    if (text === "like" && (gapAfter > 250 || /,$/.test(w.text) || (i > 0 && /,$/.test(words[i - 1]!.text)))) {
      out.push({ startMs: w.t, endMs: w.t + w.d, text: w.text });
      continue;
    }
    if (text === "you" && next && norm(next.text) === "know") {
      const after = words[i + 2];
      const gap2 = after ? after.t - (next.t + next.d) : 1000;
      if (gap2 > 200 || /[,.]$/.test(next.text)) {
        out.push({ startMs: w.t, endMs: next.t + next.d, text: `${w.text} ${next.text}` });
        i++;
      }
    }
  }
  return out;
}

/** describeFrames from @vibe/agent, with a local placeholder if the agent is unavailable. */
async function describeFramesSafe(frames: { timeMs: number; jpegBase64: string }[], shots: Shot[]): Promise<FrameDescription[]> {
  const fallback = (): FrameDescription[] =>
    frames.map((f, i) => {
      const shot = shots.find((s) => f.timeMs >= s.startMs && f.timeMs < s.endMs) ?? shots[i];
      return { timeMs: f.timeMs, description: shot ? `Shot ${formatClock(shot.startMs)}–${formatClock(shot.endMs)}` : "Shot", subjectX: 0.5, subjectY: 0.5, tags: [] };
    });
  try {
    const out: FrameDescription[] = [];
    const batch = 8;
    for (let i = 0; i < frames.length; i += batch) {
      const res = await describeFrames(frames.slice(i, i + batch));
      out.push(...res);
    }
    if (out.length !== frames.length) throw new Error("describeFrames returned a different number of frames");
    return out;
  } catch (e) {
    log("analyze", "describeFrames unavailable, using placeholders:", errorMessage(e));
    return fallback();
  }
}

export async function analyzeJob(ctx: JobContext) {
  const assetId = requireString(ctx.payload, "assetId");
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  if (asset.kind === "IMAGE") {
    await maybeEnqueuePlan(asset.projectId);
    return { assetId, skipped: "image" };
  }
  const storage = getStorage();
  const keys = storageKeys();
  const dir = await jobScratch(`analyze-${assetId}`);
  const step = (s: string) => prisma.asset.update({ where: { id: assetId }, data: { analysisStep: s } }).catch(() => {});
  try {
    const durationMs = asset.durationMs ?? 0;
    if (!durationMs) throw new Error("Asset has no duration; run ingest first.");
    const isVideo = asset.kind === "VIDEO";
    const hasAudio = !!asset.audioKey;

    // ---------- audio: silences + loudness ----------
    let silences: { startMs: number; endMs: number }[] = [];
    let loudnessLufs: number | undefined;
    let wavPath: string | null = null;
    if (hasAudio) {
      await ctx.progress(5, "Listening for silences…", true);
      await step("audio");
      wavPath = await localOriginal(asset.audioKey!, dir, "audio.wav");
      silences = await detectSilences(wavPath, -32, 0.45);
      loudnessLufs = await measureLoudness(wavPath);
    }

    // ---------- transcript ----------
    let transcript: AssetAnalysis["transcript"];
    let language: string | undefined;
    if (hasAudio && wavPath) {
      await ctx.progress(15, "Transcribing…", true);
      await step("transcribe");
      const t = await transcribe({ wavPath, durationMs, silences });
      transcript = { words: t.words, segments: t.segments, speakers: t.speakers, text: t.text };
      language = t.language;
    }

    // ---------- shots ----------
    let shots: Shot[] = [];
    if (isVideo) {
      await ctx.progress(40, "Finding shots…", true);
      await step("shots");
      const videoKey = asset.proxyKey ?? asset.storageKey;
      const videoPath = await localOriginal(videoKey, dir, "video.mp4");
      const cuts = await detectScenes(videoPath, SCENE_THRESHOLD);
      shots = buildShots(cuts, durationMs);

      await ctx.progress(55, `Looking at ${shots.length} shot${shots.length === 1 ? "" : "s"}…`, true);
      await step("keyframes");
      const times = shots.map((s) => Math.min(durationMs - 1, Math.floor((s.startMs + s.endMs) / 2)));
      const frames = await extractKeyframes(videoPath, path.join(dir, "kf"), times, 960);
      const encoded = await Promise.all(frames.map(async (f) => ({ timeMs: f.timeMs, jpegBase64: (await fsp.readFile(f.path)).toString("base64") })));

      await ctx.progress(65, "Describing what's on screen…", true);
      await step("describe");
      const descriptions = await describeFramesSafe(encoded, shots);
      for (let i = 0; i < shots.length; i++) {
        const d = descriptions[i];
        const frame = frames[i];
        const shot = shots[i]!;
        if (d) {
          shot.description = d.description;
          shot.subjectX = Math.max(0, Math.min(1, d.subjectX ?? 0.5));
          shot.subjectY = Math.max(0, Math.min(1, d.subjectY ?? 0.5));
          shot.tags = d.tags ?? [];
        }
        if (frame) {
          const key = keys.derived(assetId, `shots/shot_${String(i).padStart(3, "0")}.jpg`);
          await storage.putFile(key, frame.path, "image/jpeg");
          shot.keyframeUrl = key;
        }
      }
    }

    // ---------- quality ----------
    await ctx.progress(85, "Checking footage health…", true);
    await step("quality");
    const fillers = transcript ? findFillers(transcript.words) : [];
    const speechMs = transcript ? transcript.words.reduce((n, w) => n + w.d, 0) : 0;
    const silentMs = silences.reduce((n, s) => n + (s.endMs - s.startMs), 0);
    const nonSilentMs = Math.max(0, durationMs - silentMs);
    const hasMusic = hasAudio ? nonSilentMs / durationMs > 0.6 && speechMs / Math.max(1, nonSilentMs) < 0.3 : undefined;

    const partial: AssetAnalysis = AssetAnalysisSchema.parse({
      durationMs,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
      fps: asset.fps ?? undefined,
      hasAudio,
      language,
      transcript,
      shots,
      audio: { silences, loudnessLufs, hasMusic },
      quality: { fillers, shaky: [], dark: [] },
    });

    let hooks: AssetAnalysis["hooks"] = [];
    try {
      hooks = pickHooks(partial) ?? [];
    } catch (e) {
      log("analyze", "pickHooks failed:", errorMessage(e));
    }

    const bits: string[] = [];
    bits.push(`${isVideo ? "Video" : "Audio"} ${formatClock(durationMs)}${asset.width && asset.height ? `, ${asset.width}×${asset.height}` : ""}${asset.fps ? ` ${Math.round(asset.fps)}fps` : ""}`);
    if (isVideo) bits.push(`${shots.length} shot${shots.length === 1 ? "" : "s"}`);
    if (transcript) bits.push(`${transcript.words.length} words of speech${language === "mock" ? " (placeholder transcript: no speech-to-text key configured)" : language ? ` (${language})` : ""}${transcript.speakers.length > 1 ? `, ${transcript.speakers.length} speakers` : ""}`);
    else if (!hasAudio) bits.push("no audio");
    if (silences.length) bits.push(`${silences.length} silence${silences.length === 1 ? "" : "s"}`);
    if (fillers.length) bits.push(`${fillers.length} filler word${fillers.length === 1 ? "" : "s"}`);
    if (loudnessLufs !== undefined) bits.push(`${loudnessLufs.toFixed(1)} LUFS`);
    if (hasMusic) bits.push("music detected");
    const firstDescribed = shots.find((s) => s.description && !/^Shot \d/.test(s.description));
    if (firstDescribed?.description) bits.push(`opens on: ${firstDescribed.description}`);
    const summary = bits.join(" · ");

    const analysis = AssetAnalysisSchema.parse({ ...partial, hooks, summary });
    await prisma.asset.update({ where: { id: assetId }, data: { analysis: json(analysis), status: "READY", analysisStep: null, error: null } });
    await ctx.progress(97, "Footage understood", true);
    await maybeEnqueuePlan(asset.projectId);
    return { assetId, shots: shots.length, words: transcript?.words.length ?? 0, silences: silences.length, fillers: fillers.length, language };
  } catch (e) {
    await prisma.asset.update({ where: { id: assetId }, data: { status: "FAILED", error: errorMessage(e).slice(0, 1000), analysisStep: null } }).catch(() => {});
    await maybeEnqueuePlan(asset.projectId).catch(() => {});
    throw e;
  } finally {
    await rmrf(dir);
  }
}
