import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fsp from "node:fs/promises";
import { ffmpeg, ffprobe, synthAudio, detectSilences } from "./ffmpeg";

test("ffmpeg produces a test clip and probe reads it", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "vibe-media-"));
  const file = path.join(dir, "test.mp4");
  await ffmpeg(["-f", "lavfi", "-i", "testsrc=size=320x240:rate=30:duration=2", "-f", "lavfi", "-i", "sine=f=440:d=2", "-shortest", "-pix_fmt", "yuv420p", file]);
  const probe = await ffprobe(file);
  assert.ok(probe.durationMs >= 1900 && probe.durationMs <= 2100, String(probe.durationMs));
  assert.equal(probe.width, 320);
  assert.equal(probe.hasAudio, true);
  const sfx = await synthAudio(path.join(dir, "sfx.wav"), { seconds: 0.5, kind: "sfx", sfxId: "sfx-pop" });
  assert.ok((await ffprobe(sfx)).durationMs > 300);
  const music = await synthAudio(path.join(dir, "music.wav"), { seconds: 3, kind: "music", mood: "lofi", bpm: 90 });
  assert.ok((await ffprobe(music)).durationMs > 2500);
  const silences = await detectSilences(file, -60, 0.1);
  assert.ok(Array.isArray(silences));
});
