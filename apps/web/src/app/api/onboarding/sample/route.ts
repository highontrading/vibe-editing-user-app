/**
 * POST /api/onboarding/sample -> generates a 20 s sample clip with ffmpeg
 * (testsrc2 + "Sample footage" text + a tone with gaps), stores it, creates an
 * Asset + Project, enqueues ingest, marks the user onboarded and returns
 * { projectId, assetId }.
 */
import path from "node:path";
import fsp from "node:fs/promises";
import { prisma } from "@vibe/db";
import { enqueue, getStorage, scratchDir, storageKeys } from "@vibe/core";
import { ffmpeg } from "@vibe/media";
import { json, route } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { ensureJobRunner } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 120;

const SECONDS = 20;

async function renderSample(out: string) {
  // Audio: 440 Hz tone that is silent for 1.2 s every 5 s so the ingest finds "silences".
  const audio = `sine=f=440:d=${SECONDS},volume='if(lt(mod(t\\,5)\\,3.8)\\,0.6\\,0)':eval=frame`;
  const video = `testsrc2=size=1280x720:rate=30:d=${SECONDS}`;
  const withText = [
    "-f", "lavfi", "-i", video,
    "-f", "lavfi", "-i", audio,
    "-vf", "drawtext=text='Sample footage':fontsize=72:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2,drawtext=text='Vibe Editor demo clip':fontsize=28:fontcolor=white@0.8:x=(w-text_w)/2:y=h-80",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out,
  ];
  try {
    await ffmpeg(withText, { timeoutMs: 90_000 });
  } catch {
    // ffmpeg builds without libfreetype have no drawtext; fall back to plain testsrc2.
    await ffmpeg(["-f", "lavfi", "-i", video, "-f", "lavfi", "-i", audio, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out], { timeoutMs: 90_000 });
  }
}

export const POST = route(async () => {
  const userId = await requireUserId();
  const dir = await scratchDir(`sample-${userId}`);
  const file = path.join(dir, "sample-footage.mp4");
  await renderSample(file);
  const stat = await fsp.stat(file);

  const asset = await prisma.asset.create({ data: { userId, kind: "VIDEO", source: "LIBRARY", name: "Sample footage.mp4", mime: "video/mp4", sizeBytes: BigInt(stat.size), storageKey: "", status: "UPLOADING", folder: "Samples", tags: ["sample"], durationMs: SECONDS * 1000, width: 1280, height: 720, fps: 30 } });
  const key = storageKeys().upload(userId, asset.id, "sample-footage.mp4");
  await getStorage().putFile(key, file, "video/mp4");
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});

  const project = await prisma.project.create({
    data: {
      userId,
      title: "Sample project: a 30s teaser",
      brief: "Turn this sample clip into a punchy 15-second teaser for TikTok. Open with a strong hook, cut out the silences, add Bold Pop captions, upbeat music and a title card that says 'Sample footage'.",
      aspect: "9:16",
      platform: "tiktok",
      targetDurationMs: 15_000,
      status: "DRAFTING",
    },
  });
  await prisma.asset.update({ where: { id: asset.id }, data: { storageKey: key, status: "UPLOADED", projectId: project.id } });
  await prisma.user.update({ where: { id: userId }, data: { onboarded: true } });
  await ensureJobRunner();
  let jobId: string | null = null;
  try {
    const job = await enqueue("ingest", { assetId: asset.id }, { userId, assetId: asset.id, projectId: project.id });
    jobId = job.id;
  } catch (e) {
    console.error("[onboarding/sample] enqueue failed", e);
  }
  return json({ projectId: project.id, assetId: asset.id, jobId }, { status: 201 });
});
