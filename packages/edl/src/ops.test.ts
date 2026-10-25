import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOp, applyOps, emptyScript, mainClips, runChecks, scriptSummary } from "./index";

function base() {
  let s = emptyScript({ aspect: "9:16" });
  s = applyOp(s, { op: "registerAsset", asset: { id: "a1", kind: "video", url: "x.mp4", durationMs: 60000, width: 1920, height: 1080, source: "upload" } });
  s = applyOp(s, { op: "addVideoClip", clip: { assetId: "a1", startMs: 0, inMs: 0, outMs: 10000 } });
  s = applyOp(s, { op: "addVideoClip", clip: { assetId: "a1", startMs: 0, inMs: 20000, outMs: 30000 } });
  return s;
}

test("clips ripple contiguously and duration is computed", () => {
  const s = base();
  const clips = mainClips(s);
  assert.equal(clips.length, 2);
  assert.equal(clips[1]!.startMs, 10000);
  assert.equal(s.output.durationMs, 20000);
});

test("split and delete keep the timeline tight", () => {
  let s = base();
  const first = mainClips(s)[0]!;
  s = applyOp(s, { op: "splitClip", clipId: first.id, atMs: 4000 });
  assert.equal(mainClips(s).length, 3);
  assert.equal(mainClips(s)[1]!.inMs, 4000);
  s = applyOp(s, { op: "deleteClip", clipId: mainClips(s)[1]!.id });
  assert.equal(mainClips(s).length, 2);
  assert.equal(s.output.durationMs, 14000);
});

test("removeRange trims across clips and shifts captions", () => {
  let s = base();
  s = applyOp(s, { op: "setCaptionWords", words: [{ t: 1000, d: 300, text: "hi" }, { t: 12000, d: 300, text: "there" }] });
  s = applyOp(s, { op: "removeRange", startMs: 8000, endMs: 12000 });
  assert.equal(s.output.durationMs, 16000);
  const caps = s.tracks.find((t) => t.kind === "captions")!;
  assert.equal(caps.kind === "captions" && caps.words[1]!.t, 8000);
});

test("checks and summary run", () => {
  const s = base();
  const checks = runChecks(s, { platform: "tiktok", targetDurationMs: 20000 });
  assert.ok(checks.every((c) => c.ok), JSON.stringify(checks.filter((c) => !c.ok)));
  assert.match(scriptSummary(s), /2 clips/);
});

test("ops validate", () => {
  const s = base();
  assert.throws(() => applyOps(s, [{ op: "trimClip", clipId: "nope", inMs: 0 }]));
});
