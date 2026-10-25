/**
 * render {exportId}: ScriptVersion -> mp4 (Remotion) -> loudness-normalised
 * final file + SRT + poster in storage; Export DONE; minutes debited.
 */
import path from "node:path";
import { getStorage, storageKeys } from "@vibe/core";
import { prisma } from "@vibe/db";
import { extractFrame, ffprobe, normalizeLoudness } from "@vibe/media";
import { parseScript, type EditScript, type Word } from "@vibe/edl";
import { crfForQuality, prepareScriptForRender, renderScriptToFile } from "../renderer";
import { errorMessage, fileSize, jobScratch, rmrf } from "../util";
import { requireString, type JobContext } from "./common";

/* ------------------------------ SRT ---------------------------------- */

function srtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(r).padStart(3, "0")}`;
}

/** Group caption words into cues (max words per line from the track settings, pauses > 700 ms, max ~4 s). */
export function wordsToSrt(words: Word[], maxWords = 6): string {
  const sorted = [...words].sort((a, b) => a.t - b.t);
  const cues: { start: number; end: number; text: string }[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    const first = cur[0]!;
    const last = cur[cur.length - 1]!;
    cues.push({ start: first.t, end: Math.max(first.t + 300, last.t + last.d), text: cur.map((w) => w.text).join(" ") });
    cur = [];
  };
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i]!;
    cur.push(w);
    const next = sorted[i + 1];
    const pause = next ? next.t - (w.t + w.d) : 0;
    const span = w.t + w.d - cur[0]!.t;
    if (cur.length >= Math.max(1, maxWords) || pause > 700 || span > 4000 || /[.!?]$/.test(w.text)) flush();
  }
  flush();
  // Never let a cue overlap the next.
  for (let i = 0; i < cues.length - 1; i++) cues[i]!.end = Math.min(cues[i]!.end, cues[i + 1]!.start - 1);
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(Math.max(c.start + 1, c.end))}\n${c.text}\n`).join("\n");
}

/** Script sized for the export: same aspect -> Remotion `scale`; different aspect -> reframe to the export size. */
export function fitScriptToExport(script: EditScript, exp: { width: number; height: number; fps: number }): { script: EditScript; scale: number } {
  const out = script.output;
  const sameAspect = Math.abs(exp.width / exp.height - out.width / out.height) < 0.02;
  const copy: EditScript = { ...script, output: { ...out } };
  if (exp.fps && exp.fps !== out.fps) copy.output.fps = exp.fps;
  if (sameAspect) {
    const scale = exp.width / out.width;
    return { script: copy, scale: Math.abs(scale - 1) < 0.001 ? 1 : scale };
  }
  copy.output.width = exp.width;
  copy.output.height = exp.height;
  return { script: copy, scale: 1 };
}

export async function renderJob(ctx: JobContext) {
  const exportId = requireString(ctx.payload, "exportId");
  const exp = await prisma.export.findUnique({ where: { id: exportId }, include: { project: true } });
  if (!exp) throw new Error(`Export ${exportId} not found`);
  const version = await prisma.scriptVersion.findUnique({ where: { id: exp.versionId } });
  if (!version) throw new Error(`Script version ${exp.versionId} not found`);
  const project = exp.project;
  const storage = getStorage();
  const keys = storageKeys();
  const dir = await jobScratch(`render-${exportId}`);
  const previousStatus = project.status;

  await prisma.$transaction([
    prisma.export.update({ where: { id: exportId }, data: { status: "RUNNING", jobId: exp.jobId ?? ctx.jobId } }),
    prisma.project.update({ where: { id: project.id }, data: { status: "EXPORTING", statusMessage: "Exporting…" } }),
  ]);

  try {
    await ctx.progress(2, "Preparing the render…", true);
    const source = parseScript(version.script);
    const captionTracks = source.tracks.filter((t) => t.kind === "captions");
    const srt = captionTracks.filter((t) => t.enabled && t.words.length).map((t) => wordsToSrt(t.words, t.settings.maxWordsPerLine)).join("\n");

    const { script: sized, scale } = fitScriptToExport(source, exp);
    const renderScript: EditScript = exp.burnCaptions ? sized : { ...sized, tracks: sized.tracks.map((t) => (t.kind === "captions" ? { ...t, enabled: false } : t)) };
    const resolved = await prepareScriptForRender(renderScript);

    const rawFile = path.join(dir, "render.mp4");
    const finalFile = path.join(dir, "final.mp4");
    await ctx.progress(5, "Rendering 0%", true);
    let lastPct = -1;
    await renderScriptToFile(resolved, {
      outputFile: rawFile,
      watermark: exp.watermark,
      scale,
      crf: crfForQuality(exp.quality),
      onProgress: (fraction) => {
        const pct = Math.round(fraction * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          void ctx.progress(5 + fraction * 78, `Rendering ${pct}%`);
        }
      },
    });

    await ctx.progress(85, "Balancing audio levels…", true);
    const targetLufs = source.meta.targetLufs ?? -14;
    let outFile = finalFile;
    try {
      await normalizeLoudness(rawFile, finalFile, targetLufs);
    } catch (e) {
      console.warn("[pipeline:render] loudnorm failed, keeping raw render:", errorMessage(e));
      outFile = rawFile;
    }
    const info = await ffprobe(outFile);
    const durationMs = info.durationMs || source.output.durationMs;

    await ctx.progress(90, "Making the thumbnail…", true);
    const poster = path.join(dir, "poster.jpg");
    await extractFrame(outFile, poster, Math.floor(durationMs * 0.1), 640).catch(() => extractFrame(outFile, poster, 0, 640));

    await ctx.progress(94, "Uploading…", true);
    const base = (project.title || "export").replace(/[^\w\-]+/g, "_").slice(0, 40) || "export";
    const storageKey = keys.render(project.id, exportId, `${base}_${exp.width}x${exp.height}.mp4`);
    const thumbKey = keys.render(project.id, exportId, "poster.jpg");
    await storage.putFile(storageKey, outFile, "video/mp4");
    await storage.putFile(thumbKey, poster, "image/jpeg");
    let srtKey: string | null = null;
    if (srt.trim()) {
      srtKey = keys.render(project.id, exportId, `${base}.srt`);
      await storage.put(srtKey, srt, "application/x-subrip");
    }
    const sizeBytes = await fileSize(outFile);

    const minutes = Math.round((durationMs / 60000) * 1000) / 1000;
    await prisma.$transaction([
      prisma.export.update({
        where: { id: exportId },
        data: { status: "DONE", storageKey, thumbKey, srtKey, sizeBytes: BigInt(sizeBytes), durationMs, finishedAt: new Date() },
      }),
      prisma.user.update({ where: { id: project.userId }, data: { minutesUsed: { increment: minutes } } }),
      prisma.creditLedger.create({ data: { userId: project.userId, minutes: -minutes, reason: "export", ref: exportId } }),
      prisma.project.update({ where: { id: project.id }, data: { status: "READY", statusMessage: null } }),
    ]);
    await ctx.progress(100, "Export ready", true);
    return { exportId, storageKey, thumbKey, srtKey, durationMs, sizeBytes, minutes };
  } catch (e) {
    await prisma.$transaction([
      prisma.export.update({ where: { id: exportId }, data: { status: "FAILED", finishedAt: new Date() } }),
      prisma.project.update({ where: { id: project.id }, data: { status: previousStatus === "EXPORTING" ? "READY" : previousStatus, statusMessage: `Export failed: ${errorMessage(e).slice(0, 300)}` } }),
    ]).catch(() => {});
    throw e;
  } finally {
    await rmrf(dir);
  }
}
