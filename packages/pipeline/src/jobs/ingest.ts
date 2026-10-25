/**
 * ingest {assetId}: probe the upload, make preview files (proxy, poster,
 * thumbnail strip, waveform, 16 kHz wav) and hand over to `analyze`.
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { enqueue, getStorage, storageKeys } from "@vibe/core";
import { prisma } from "@vibe/db";
import { extractAudio, extractFrame, ffmpeg, ffprobe, makeProxy, thumbnailStrip, waveformPeaks } from "@vibe/media";
import { errorMessage, jobScratch, mimeForExt, probeImage, rmrf } from "../util";
import { maybeEnqueuePlan, requireString, type JobContext } from "./common";

/** Original file on local disk: the storage path itself for the local driver, else a download. */
export async function localOriginal(key: string, dir: string, filename: string): Promise<string> {
  const storage = getStorage();
  const lp = storage.localPath(key);
  if (lp) {
    await fsp.access(lp);
    return lp;
  }
  return storage.downloadToFile(key, path.join(dir, filename));
}

export async function ingestJob(ctx: JobContext) {
  const assetId = requireString(ctx.payload, "assetId");
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  const storage = getStorage();
  const keys = storageKeys();
  const dir = await jobScratch(`ingest-${assetId}`);
  try {
    await prisma.asset.update({ where: { id: assetId }, data: { status: "PROCESSING", error: null, analysisStep: "ingest" } });
    await ctx.progress(3, "Fetching your file…", true);
    const ext = path.extname(asset.name) || (asset.kind === "VIDEO" ? ".mp4" : asset.kind === "AUDIO" ? ".mp3" : ".jpg");
    const original = await localOriginal(asset.storageKey, dir, `original${ext}`);
    const sizeBytes = (await fsp.stat(original)).size;

    await ctx.progress(8, "Reading media info…");

    if (asset.kind === "IMAGE") {
      const { width, height } = await probeImage(original);
      await ctx.progress(40, "Making thumbnail…");
      const thumb = path.join(dir, "thumb.jpg");
      await ffmpeg(["-i", original, "-vf", "scale='min(640,iw)':-2", "-frames:v", "1", "-q:v", "3", thumb]);
      const thumbKey = keys.derived(assetId, "thumb.jpg");
      await storage.putFile(thumbKey, thumb, "image/jpeg");
      await prisma.asset.update({
        where: { id: assetId },
        data: { width, height, thumbKey, sizeBytes: BigInt(sizeBytes), status: "READY", analysisStep: null, analysis: { durationMs: 0, width, height, hasAudio: false, shots: [], summary: `Image ${width ?? "?"}×${height ?? "?"}` } },
      });
      await ctx.progress(95, "Image ready");
      await maybeEnqueuePlan(asset.projectId);
      return { assetId, kind: "image", width, height };
    }

    const info = await ffprobe(original);
    if (!info.durationMs) throw new Error("Could not read the media duration; the file may be corrupt or still uploading.");
    const durationMs = info.durationMs;

    if (asset.kind === "AUDIO") {
      await ctx.progress(30, "Drawing waveform…");
      const peaks = await waveformPeaks(original, 10);
      const waveformKey = keys.derived(assetId, "waveform.json");
      await storage.put(waveformKey, JSON.stringify({ pointsPerSec: 10, durationMs, peaks }), "application/json");
      await ctx.progress(60, "Preparing audio for transcription…");
      const wav = path.join(dir, "audio.wav");
      await extractAudio(original, wav);
      const audioKey = keys.derived(assetId, "audio.wav");
      await storage.putFile(audioKey, wav, "audio/wav");
      await prisma.asset.update({
        where: { id: assetId },
        data: { durationMs, waveformKey, audioKey, sizeBytes: BigInt(sizeBytes), status: "READY", analysisStep: null },
      });
      await ctx.progress(95, "Audio ready");
      // Transcript + silences are still useful for voice-overs; analyze keeps the asset READY.
      await enqueue("analyze", { assetId }, { userId: asset.userId, projectId: asset.projectId ?? undefined, assetId });
      return { assetId, kind: "audio", durationMs };
    }

    // VIDEO
    if (!info.hasVideo) throw new Error("No video stream found in this file.");
    const data: Record<string, unknown> = {
      durationMs,
      width: info.width,
      height: info.height,
      fps: info.fps,
      sizeBytes: BigInt(sizeBytes),
    };

    await ctx.progress(12, "Making preview…", true);
    const proxy = path.join(dir, "proxy.mp4");
    await makeProxy(original, proxy, {
      onProgress: (p) => {
        if (p.timeMs !== undefined) void ctx.progress(12 + Math.min(1, p.timeMs / durationMs) * 48, "Making preview…");
      },
    });
    const proxyKey = keys.derived(assetId, "proxy.mp4");
    await storage.putFile(proxyKey, proxy, "video/mp4");
    data.proxyKey = proxyKey;

    await ctx.progress(64, "Picking a poster frame…", true);
    const poster = path.join(dir, "poster.jpg");
    await extractFrame(proxy, poster, Math.floor(durationMs * 0.1), 640);
    const thumbKey = keys.derived(assetId, "poster.jpg");
    await storage.putFile(thumbKey, poster, "image/jpeg");
    data.thumbKey = thumbKey;

    await ctx.progress(70, "Building thumbnail strip…");
    const stripPath = path.join(dir, "strip.jpg");
    const everySec = durationMs > 10 * 60_000 ? 10 : durationMs > 3 * 60_000 ? 5 : 2;
    const strip = await thumbnailStrip(proxy, stripPath, durationMs, everySec, 160);
    const stripInfo = await probeImage(stripPath).catch(() => ({ width: undefined, height: undefined }));
    await storage.putFile(keys.derived(assetId, "strip.jpg"), stripPath, "image/jpeg");
    await storage.put(
      keys.derived(assetId, "strip.json"),
      JSON.stringify({ key: keys.derived(assetId, "strip.jpg"), count: strip.count, everySec: strip.everySec, frameWidth: strip.width, frameHeight: stripInfo.height ?? null, totalWidth: stripInfo.width ?? null, durationMs }),
      "application/json",
    );

    if (info.hasAudio) {
      await ctx.progress(80, "Drawing waveform…");
      const peaks = await waveformPeaks(original, 10);
      const waveformKey = keys.derived(assetId, "waveform.json");
      await storage.put(waveformKey, JSON.stringify({ pointsPerSec: 10, durationMs, peaks }), "application/json");
      data.waveformKey = waveformKey;

      await ctx.progress(88, "Preparing audio for transcription…");
      const wav = path.join(dir, "audio.wav");
      await extractAudio(original, wav);
      const audioKey = keys.derived(assetId, "audio.wav");
      await storage.putFile(audioKey, wav, "audio/wav");
      data.audioKey = audioKey;
    }

    await prisma.asset.update({ where: { id: assetId }, data: { ...data, status: "PROCESSING", analysisStep: "queued" } });
    await ctx.progress(96, "Preview ready, analysing next…", true);
    await enqueue("analyze", { assetId }, { userId: asset.userId, projectId: asset.projectId ?? undefined, assetId });
    return { assetId, kind: "video", durationMs, width: info.width, height: info.height, hasAudio: info.hasAudio, mime: mimeForExt(ext) };
  } catch (e) {
    await prisma.asset.update({ where: { id: assetId }, data: { status: "FAILED", error: errorMessage(e).slice(0, 1000), analysisStep: null } }).catch(() => {});
    await maybeEnqueuePlan(asset.projectId).catch(() => {});
    throw e;
  } finally {
    await rmrf(dir);
  }
}
