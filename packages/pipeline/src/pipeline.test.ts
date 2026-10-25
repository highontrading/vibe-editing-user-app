/**
 * End-to-end pipeline tests against the local Postgres + local storage driver.
 *   node --import tsx --test src/pipeline.test.ts
 * Env: DATABASE_URL (read from the repo .env when unset). SKIP_RENDER=1 skips the Remotion tests.
 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { JobType } from "@vibe/core";
import type { AssetAnalysis, EditScript, Word } from "@vibe/edl";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

async function loadDotenv(file: string) {
  try {
    const text = await fsp.readFile(file, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
      if (!m) continue;
      const [, k, raw] = m;
      const v = raw!.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      if (!process.env[k!]) process.env[k!] = v;
    }
  } catch {
    /* no .env */
  }
}
await loadDotenv(path.join(repoRoot, ".env"));
process.env.REDIS_URL = ""; // force the inline queue path
process.env.DATA_DIR = await fsp.mkdtemp(path.join(os.tmpdir(), "vibe-pipeline-test-"));
process.env.APP_URL ||= "http://localhost:3000";
const SKIP_RENDER = process.env.SKIP_RENDER === "1";
const REAL_ELEVEN = !!process.env.ELEVENLABS_API_KEY;
const REAL_STOCK = !!(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY);

const { getStorage, storageKeys, registerInlineRunner } = await import("@vibe/core");
const { prisma } = await import("@vibe/db");
const { ffmpeg, ffprobe } = await import("@vibe/media");
const { emptyScript, parseScript } = await import("@vibe/edl");
const pipeline = await import("./index");
const { assetRefFromRow } = await import("./context");

let dbOk = true;
try {
  await prisma.$queryRaw`select 1`;
} catch (e) {
  dbOk = false;
  console.warn("DATABASE_URL not reachable; pipeline tests will be skipped:", (e as Error).message.split("\n")[0]);
}

// Jobs enqueued by the pipeline are captured (and found in the DB) instead of run automatically.
registerInlineRunner(async () => {});

const storage = getStorage();
const stamp = Date.now().toString(36);
const state: {
  userId: string;
  projectId: string;
  assetId: string;
  analysis?: AssetAnalysis;
  musicRef?: Awaited<ReturnType<typeof pipeline.media.getMusic>>;
  exportId?: string;
} = { userId: "", projectId: "", assetId: "" };

async function run(type: JobType, payload: Record<string, unknown>) {
  const row = await prisma.job.create({
    data: { type, payload: payload as object, status: "QUEUED", userId: state.userId || undefined, projectId: (payload.projectId as string) ?? state.projectId ?? undefined, assetId: (payload.assetId as string) ?? undefined },
  });
  let error: unknown = null;
  try {
    await pipeline.runJob({ id: row.id, type, payload });
  } catch (e) {
    error = e;
  }
  const job = await prisma.job.findUniqueOrThrow({ where: { id: row.id } });
  return { job, error };
}

async function queuedJob(type: JobType, where: Record<string, unknown>) {
  return prisma.job.findFirst({ where: { type, status: "QUEUED", ...where }, orderBy: { createdAt: "desc" } });
}

async function makeTestClip(file: string) {
  // 6 s: two visually different halves (-> a scene cut) + a 440 Hz tone with a 1 s silent gap in the middle.
  await ffmpeg([
    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=3",
    "-f", "lavfi", "-i", "smptebars=size=640x360:rate=30:duration=3",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=6",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v];[2:a]volume=enable='between(t,2.5,3.5)':volume=0[a]",
    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-shortest", file,
  ]);
}

test("setup: user, project and uploaded asset", { skip: !dbOk }, async () => {
  const user = await prisma.user.create({ data: { email: `pipeline-test-${stamp}@example.com`, name: "Pipeline Test" } });
  state.userId = user.id;
  const project = await prisma.project.create({
    data: { userId: user.id, title: "Pipeline test", status: "ANALYZING", aspect: "16:9", platform: "youtube", brief: "A quick test edit" },
  });
  state.projectId = project.id;
  const tmp = path.join(process.env.DATA_DIR!, "clip.mp4");
  await makeTestClip(tmp);
  const asset = await prisma.asset.create({
    data: { userId: user.id, projectId: project.id, kind: "VIDEO", source: "UPLOAD", name: "clip.mp4", mime: "video/mp4", storageKey: "pending", status: "UPLOADING" },
  });
  const key = storageKeys().upload(user.id, asset.id, "clip.mp4");
  await storage.putFile(key, tmp, "video/mp4");
  await prisma.asset.update({ where: { id: asset.id }, data: { storageKey: key, status: "UPLOADED", sizeBytes: BigInt((await fsp.stat(tmp)).size) } });
  state.assetId = asset.id;
});

test("ingest: proxy, poster, strip, waveform, audio + analyze enqueued", { skip: !dbOk }, async () => {
  const { job, error } = await run("ingest", { assetId: state.assetId });
  assert.equal(error, null, `ingest failed: ${(error as Error)?.message}`);
  assert.equal(job.status, "DONE");
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: state.assetId } });
  assert.equal(asset.status, "PROCESSING");
  assert.ok(asset.proxyKey && (await storage.exists(asset.proxyKey)), "proxy exists");
  assert.ok(asset.thumbKey && (await storage.exists(asset.thumbKey)), "poster exists");
  assert.ok(asset.waveformKey && (await storage.exists(asset.waveformKey)), "waveform exists");
  assert.ok(asset.audioKey && (await storage.exists(asset.audioKey)), "wav exists");
  assert.ok(await storage.exists(storageKeys().derived(state.assetId, "strip.json")), "strip metadata exists");
  assert.ok(Math.abs((asset.durationMs ?? 0) - 6000) < 300, `duration ${asset.durationMs}`);
  assert.equal(asset.width, 640);
  assert.equal(asset.height, 360);
  assert.ok(await queuedJob("analyze", { assetId: state.assetId }), "analyze job enqueued");
});

test("analyze: transcript (mock), shots, silences, READY + plan enqueued", { skip: !dbOk }, async () => {
  const queued = await queuedJob("analyze", { assetId: state.assetId });
  assert.ok(queued);
  let error: unknown = null;
  try {
    await pipeline.runJob({ id: queued.id, type: "analyze", payload: queued.payload as Record<string, unknown> });
  } catch (e) {
    error = e;
  }
  assert.equal(error, null, `analyze failed: ${(error as Error)?.message}`);
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: state.assetId } });
  assert.equal(asset.status, "READY");
  const analysis = pipeline.parseAnalysis(asset.analysis);
  assert.ok(analysis, "analysis parses");
  state.analysis = analysis;
  assert.ok(Math.abs(analysis.durationMs - 6000) < 300);
  assert.ok(analysis.shots.length >= 1, "at least one shot");
  assert.ok(analysis.shots.length >= 2, `scene cut detected (${analysis.shots.length} shots)`);
  assert.ok(analysis.shots.every((s) => s.keyframeUrl && s.description), "shots have keyframes + descriptions");
  assert.ok(await storage.exists(analysis.shots[0]!.keyframeUrl!), "keyframe uploaded");
  assert.ok((analysis.transcript?.words.length ?? 0) > 0, "mock transcript has words");
  assert.equal(analysis.language, "mock");
  assert.ok(analysis.audio.silences.length >= 1, "silence gap found");
  const gap = analysis.audio.silences.find((s) => s.startMs > 2000 && s.endMs < 4000);
  assert.ok(gap, `gap around 2.5–3.5 s: ${JSON.stringify(analysis.audio.silences)}`);
  assert.ok(typeof analysis.audio.loudnessLufs === "number");
  assert.ok(analysis.summary && analysis.summary.length > 10);
  const project = await prisma.project.findUniqueOrThrow({ where: { id: state.projectId } });
  assert.equal(project.status, "PLANNING");
  assert.ok(await queuedJob("plan", { projectId: state.projectId }), "plan job enqueued once all assets are READY");
});

test("plan -> build -> edit through the agent (skipped while the agent is a stub)", { skip: !dbOk }, async (t) => {
  const planJob = await queuedJob("plan", { projectId: state.projectId });
  assert.ok(planJob);
  const planRun = await run("plan", { projectId: state.projectId });
  if (planRun.error && /not implemented/i.test((planRun.error as Error).message)) {
    const project = await prisma.project.findUniqueOrThrow({ where: { id: state.projectId } });
    assert.equal(project.status, "FAILED");
    // Put the project back so the render test has a sane state.
    await prisma.project.update({ where: { id: state.projectId }, data: { status: "READY", statusMessage: null } });
    t.skip("agent createPlan() is still a stub; the integrator wires it");
    return;
  }
  assert.equal(planRun.error, null, `plan failed: ${(planRun.error as Error)?.message}`);
  let project = await prisma.project.findUniqueOrThrow({ where: { id: state.projectId } });
  assert.equal(project.status, "PLAN_READY");
  assert.ok(project.plan);
  const planMsg = await prisma.message.findFirst({ where: { projectId: state.projectId, role: "ASSISTANT" }, orderBy: { createdAt: "desc" } });
  assert.ok(planMsg && (planMsg.data as { plan?: unknown })?.plan);

  const buildRun = await run("build", { projectId: state.projectId });
  if (buildRun.error && /not implemented/i.test((buildRun.error as Error).message)) {
    await prisma.project.update({ where: { id: state.projectId }, data: { status: "READY", statusMessage: null } });
    t.skip("agent buildScript() is still a stub");
    return;
  }
  assert.equal(buildRun.error, null, `build failed: ${(buildRun.error as Error)?.message}`);
  project = await prisma.project.findUniqueOrThrow({ where: { id: state.projectId } });
  assert.equal(project.status, "READY");
  assert.ok(project.currentVersionId);
  assert.ok(await queuedJob("thumbnail", { projectId: state.projectId }));

  const userMsg = await prisma.message.create({ data: { projectId: state.projectId, role: "USER", content: "Make the intro faster" } });
  const pending = await prisma.message.create({ data: { projectId: state.projectId, role: "ASSISTANT", content: "", status: "pending", data: { userMessageId: userMsg.id } } });
  const editRun = await run("edit", { projectId: state.projectId, messageId: userMsg.id });
  const reply = await prisma.message.findUniqueOrThrow({ where: { id: pending.id } });
  if (editRun.error && /not implemented/i.test((editRun.error as Error).message)) {
    assert.equal(reply.status, "error");
    t.skip("agent editScript() is still a stub");
    return;
  }
  assert.equal(editRun.error, null);
  assert.equal(reply.status, "done");
  assert.ok(reply.versionId);
});

test(`media provider (${REAL_ELEVEN ? "ElevenLabs" : "mock"} audio, ${REAL_STOCK ? "real" : "mock"} stock)`, { skip: !dbOk, timeout: 5 * 60_000 }, async () => {
  const music = await pipeline.media.getMusic({ mood: "lofi", durationMs: 4000, projectId: state.projectId });
  assert.equal(music.kind, "audio");
  assert.ok(await storage.exists(music.url), music.url);
  console.log(`music: ${music.url} ${music.durationMs} ms source=${music.source}`);
  if (REAL_ELEVEN) {
    assert.ok(music.url.startsWith(`generated/${state.projectId}/music-lofi-`), music.url);
    assert.equal(music.source, "generated");
    assert.ok((music.durationMs ?? 0) >= 10000, `ElevenLabs music is >= 10 s (${music.durationMs})`);
  } else {
    assert.ok(music.url.startsWith("library/music/"), music.url);
    assert.equal(music.source, "library");
    assert.ok((music.durationMs ?? 0) >= 14000, `placeholder bed is >= 15 s (${music.durationMs})`);
    const again = await pipeline.media.getMusic({ mood: "lofi", durationMs: 9000, projectId: state.projectId });
    assert.equal(again.id, music.id, "same bucket -> same cached asset");
  }
  state.musicRef = music;

  const sfx = await pipeline.media.getSfx({ sfxId: "sfx-whoosh-1", projectId: state.projectId });
  assert.ok(sfx.url.startsWith(REAL_ELEVEN ? "library/sfx/el-" : "library/sfx/"), sfx.url);
  assert.ok(await storage.exists(sfx.url));
  console.log(`sfx: ${sfx.url} ${sfx.durationMs} ms`);
  const sfxAgain = await pipeline.media.getSfx({ sfxId: "sfx-whoosh-1", projectId: state.projectId });
  assert.equal(sfxAgain.id, sfx.id, "sfx cached in the library");

  const stock = await pipeline.media.searchStock({ query: "coffee cup", kind: "video", orientation: "landscape", projectId: state.projectId, limit: 2 });
  assert.ok(stock.length >= 1 && stock.length <= 2, `stock results: ${stock.length}`);
  for (const s of stock) {
    assert.equal(s.kind, "video");
    assert.equal(s.source, "stock");
    assert.ok(await storage.exists(s.url), s.url);
    const row = await prisma.asset.findUnique({ where: { id: s.id } });
    assert.equal(row?.source, "STOCK");
    assert.equal(row?.projectId, state.projectId);
    if (!REAL_STOCK) assert.equal(s.width, 1280);
  }
  if (!REAL_STOCK) assert.equal(stock.length, 2);
  const images = await pipeline.media.searchStock({ query: "sunrise", kind: "image", orientation: "portrait", projectId: state.projectId, limit: 1 });
  assert.equal(images.length, 1);
  assert.equal(images[0]!.kind, "image");
  if (REAL_ELEVEN) {
    assert.ok(pipeline.media.generateVoice, "ElevenLabs key -> voice generation available");
    const voice = await pipeline.media.generateVoice!({ text: "Hello from the pipeline test.", projectId: state.projectId });
    assert.equal(voice.kind, "audio");
    assert.ok(await storage.exists(voice.url));
    assert.ok((voice.durationMs ?? 0) > 500, `voice duration ${voice.durationMs}`);
    console.log(`voice: ${voice.url} ${voice.durationMs} ms`);
  } else {
    assert.equal(pipeline.media.generateVoice, undefined, "no ElevenLabs key -> no voice generation");
  }
});

test("generate job stores an asset and returns its id", { skip: !dbOk }, async () => {
  const { job, error } = await run("generate", { projectId: state.projectId, kind: "sfx", params: { sfxId: "sfx-pop" } });
  assert.equal(error, null);
  assert.equal(job.status, "DONE");
  const result = job.result as { assetId: string };
  assert.ok(result.assetId);
  assert.ok(await prisma.asset.findUnique({ where: { id: result.assetId } }));
});

function buildTestScript(assetRow: Parameters<typeof assetRefFromRow>[0]): EditScript {
  const base = emptyScript({ width: 640, height: 360, fps: 30, platform: "youtube", title: "Pipeline test" });
  const music = state.musicRef!;
  const transcriptWords = state.analysis?.transcript?.words ?? [];
  const words: Word[] = [
    ...transcriptWords.filter((w) => w.t + w.d <= 2000).map((w) => ({ t: w.t, d: w.d, text: w.text })),
    ...transcriptWords.filter((w) => w.t >= 3500 && w.t + w.d <= 5500).map((w) => ({ t: w.t - 1500, d: w.d, text: w.text })),
  ];
  if (!words.length) words.push({ t: 200, d: 400, text: "Hello" }, { t: 700, d: 400, text: "there" });
  const raw = {
    ...base,
    assets: { [assetRow.id]: assetRefFromRow(assetRow), [music.id]: music },
    tracks: [
      { id: "v-main", kind: "video", layer: 0, name: "Main", clips: [
        { id: "c1", assetId: assetRow.id, startMs: 0, inMs: 0, outMs: 2000, reason: "opening" },
        { id: "c2", assetId: assetRow.id, startMs: 2000, inMs: 3500, outMs: 5500, transitionIn: { type: "crossfade", durationMs: 300 } },
      ] },
      { id: "captions", kind: "captions", style: "bold-pop", words, enabled: true, name: "Captions" },
      { id: "music", kind: "audio", role: "music", clips: [{ id: "m1", assetId: music.id, startMs: 0, gainDb: -16, ducking: true, loop: true, fadeOutMs: 500 }] },
      { id: "gfx", kind: "graphics", items: [{ id: "g1", component: "KineticTitle", startMs: 0, durationMs: 1500, props: { text: "Pipeline test" } }] },
    ],
  };
  return parseScript(raw);
}

test("render: export -> DONE with mp4, srt, poster and minutes debited", { skip: !dbOk || SKIP_RENDER, timeout: 10 * 60_000 }, async () => {
  const assetRow = await prisma.asset.findUniqueOrThrow({ where: { id: state.assetId } });
  const script = buildTestScript(assetRow);
  assert.equal(script.output.durationMs, 4000);
  const version = await prisma.scriptVersion.create({ data: { projectId: state.projectId, source: "USER", script: script as object, summary: "test script", label: "hand-built" } });
  await prisma.project.update({ where: { id: state.projectId }, data: { currentVersionId: version.id, status: "READY" } });
  const exp = await prisma.export.create({
    data: { projectId: state.projectId, versionId: version.id, preset: "youtube", width: 640, height: 360, fps: 30, burnCaptions: true, quality: "720p", watermark: true },
  });
  state.exportId = exp.id;
  const before = await prisma.user.findUniqueOrThrow({ where: { id: state.userId } });

  const { job, error } = await run("render", { exportId: exp.id });
  assert.equal(error, null, `render failed: ${(error as Error)?.message}`);
  assert.equal(job.status, "DONE");
  assert.equal(job.progress, 100);

  const done = await prisma.export.findUniqueOrThrow({ where: { id: exp.id } });
  assert.equal(done.status, "DONE");
  assert.ok(done.storageKey && done.storageKey.startsWith(`renders/${state.projectId}/${exp.id}/`));
  const file = storage.localPath(done.storageKey!)!;
  await fsp.access(file);
  const info = await ffprobe(file);
  assert.ok(Math.abs(info.durationMs - 4000) < 400, `rendered duration ${info.durationMs}`);
  assert.ok(info.hasAudio, "render has an audio track");
  assert.equal(info.width, 640);
  assert.ok(Number(done.sizeBytes) > 1000);
  assert.ok(Math.abs((done.durationMs ?? 0) - 4000) < 400);
  assert.ok(done.finishedAt);
  assert.ok(done.thumbKey && (await storage.exists(done.thumbKey)), "poster uploaded");
  assert.ok(done.srtKey && (await storage.exists(done.srtKey)), "srt uploaded");
  const srt = (await storage.getBuffer(done.srtKey!)).toString("utf8");
  assert.match(srt, /-->/);

  const after_ = await prisma.user.findUniqueOrThrow({ where: { id: state.userId } });
  assert.ok(after_.minutesUsed > before.minutesUsed, "minutes debited");
  const ledger = await prisma.creditLedger.findFirst({ where: { userId: state.userId, reason: "export", ref: exp.id } });
  assert.ok(ledger && ledger.minutes < 0);
  const project = await prisma.project.findUniqueOrThrow({ where: { id: state.projectId } });
  assert.equal(project.status, "READY");
});

test("thumbnail: still of the current script", { skip: !dbOk || SKIP_RENDER, timeout: 5 * 60_000 }, async () => {
  const { job, error } = await run("thumbnail", { projectId: state.projectId });
  assert.equal(error, null, `thumbnail failed: ${(error as Error)?.message}`);
  assert.equal(job.status, "DONE");
  const project = await prisma.project.findUniqueOrThrow({ where: { id: state.projectId } });
  assert.ok(project.thumbKey && (await storage.exists(project.thumbKey)));
});

test("cleanup job runs", { skip: !dbOk }, async () => {
  const { job, error } = await run("cleanup", {});
  assert.equal(error, null);
  assert.equal(job.status, "DONE");
});

after(async () => {
  if (dbOk && state.userId) await prisma.user.delete({ where: { id: state.userId } }).catch(() => {});
  await prisma.$disconnect().catch(() => {});
  if (process.env.KEEP_TEST_DATA !== "1") await fsp.rm(process.env.DATA_DIR!, { recursive: true, force: true }).catch(() => {});
});
