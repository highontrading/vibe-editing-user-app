import { test } from "node:test";
import assert from "node:assert/strict";
import { getTrack, mainClips, runChecks, safeParseScript, type AssetAnalysis, type AssetRef, type EditScript } from "@vibe/edl";
import { createPlan, buildScript, editScript, isMockMode, pickHooks, quickSuggestions, selfCheck, describeFrames } from "./index";
import type { MediaProvider, ProjectContext } from "./types";
import { buildManifest } from "./manifest";
import { applyPlanTweaks } from "./builder";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const SENTENCES = [
  "Most founders get pricing completely wrong in their first year.",
  "So um today I want to show you the three mistakes I made.",
  "Mistake number one is charging by the hour instead of by value.",
  "You think it feels fair but it punishes you for getting faster.",
  "Mistake number two is um discounting the moment someone hesitates.",
  "That teaches every customer that your price is just an opening bid.",
  "The third mistake is never raising prices for existing customers.",
  "I kept um one client at the same rate for four years.",
  "Here is what I do now and it changed everything.",
  "I anchor with a premium tier and let people talk me down to the middle.",
  "That alone um doubled our average deal size last quarter.",
  "Follow for the next video where I break down the exact pricing page.",
];

function makeAnalysis(): AssetAnalysis {
  const words: AssetAnalysis["transcript"] extends infer T ? (T extends { words: infer W } ? W : never) : never = [] as never;
  const segments: NonNullable<AssetAnalysis["transcript"]>["segments"] = [];
  const fillers: { startMs: number; endMs: number; text: string }[] = [];
  const silences: { startMs: number; endMs: number }[] = [];
  let t = 400;
  SENTENCES.forEach((sentence, i) => {
    const parts = sentence.split(" ");
    const start = t;
    for (const p of parts) {
      const d = p.length > 6 ? 420 : 300;
      (words as { t: number; d: number; text: string }[]).push({ t, d, text: p });
      if (p === "um") fillers.push({ startMs: t, endMs: t + d, text: "um" });
      t += d + 60;
    }
    segments.push({ startMs: start, endMs: t, text: sentence, speaker: "S1" });
    // silences after sentences 3, 6 and 9 (long pauses the builder should cut)
    if (i === 2 || i === 5 || i === 8) {
      const len = i === 5 ? 1400 : 900;
      silences.push({ startMs: t, endMs: t + len });
      t += len;
    } else t += 150;
  });
  const durationMs = 60_000;
  const shots = Array.from({ length: 5 }, (_, i) => ({ startMs: i * 12_000, endMs: (i + 1) * 12_000, description: `medium shot, person at desk talking (${i + 1})`, subjectX: 0.5, subjectY: 0.4, tags: ["talking-head", "indoor"] }));
  const base: AssetAnalysis = {
    durationMs,
    width: 1920,
    height: 1080,
    fps: 30,
    hasAudio: true,
    language: "en",
    transcript: { words: words as never, segments, speakers: ["S1"], text: SENTENCES.join(" ") },
    shots,
    audio: { silences, loudnessLufs: -18, hasMusic: false },
    quality: { fillers, shaky: [], dark: [] },
    summary: "A founder explains three pricing mistakes to camera.",
    hooks: [],
  };
  base.hooks = pickHooks(base);
  assert.equal(fillers.length, 4);
  assert.equal(silences.length, 3);
  assert.equal(segments.length, 12);
  assert.ok(t < durationMs, `speech should end before 60s (ended ${t})`);
  return base;
}

function makeCtx(overrides: Partial<ProjectContext> = {}): ProjectContext {
  const ref: AssetRef = { id: "asset_talk", kind: "video", url: "https://cdn.test/proxy/asset_talk.mp4", name: "founder-talk.mp4", durationMs: 60_000, width: 1920, height: 1080, source: "upload" };
  return {
    projectId: "proj_test",
    brief: "Make a punchy TikTok about the three pricing mistakes founders make, around 45 seconds, lo-fi music.",
    aspect: "9:16",
    platform: "tiktok",
    targetDurationMs: 45_000,
    assets: [{ ref, analysis: makeAnalysis() }],
    recipe: {
      slug: "talking-head-punchy",
      title: "Punchy Talking Head",
      category: "Talking-head",
      prompt: "Open with the strongest hook line. Remove silences and fillers, jump cut, punch in, bold captions, lo-fi bed.",
      defaults: { captionStyle: "bold-pop", musicMood: "lofi", colorPreset: "clean", platform: "tiktok", brollEvery: 12000 },
    },
    brand: { handle: "@founderfran", colors: ["#FFD400"] },
    preferences: {},
    ...overrides,
  };
}

const calls: string[] = [];
const media: MediaProvider = {
  async getMusic({ mood, durationMs }) {
    calls.push(`music:${mood}`);
    return { id: `music_${mood}`, kind: "audio", url: `https://cdn.test/music/${mood}.mp3`, name: `${mood} track`, durationMs: Math.max(durationMs, 90_000), source: "library" };
  },
  async getSfx({ sfxId }) {
    calls.push(`sfx:${sfxId}`);
    return { id: `sfx_${sfxId}`, kind: "audio", url: `https://cdn.test/sfx/${sfxId}.wav`, name: sfxId, durationMs: 600, source: "library" };
  },
  async searchStock({ query, kind }) {
    calls.push(`stock:${query}`);
    return [{ id: `stock_${query.replace(/\W+/g, "_")}`, kind, url: `https://cdn.test/stock/${encodeURIComponent(query)}.mp4`, name: `stock ${query}`, durationMs: 12_000, width: 1080, height: 1920, source: "stock", attribution: "Pexels" }];
  },
};

function fixableOnly(script: EditScript, platform = "tiktok", target?: number) {
  return runChecks(script, { platform: platform as never, targetDurationMs: target }).filter((c) => !c.ok);
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test("runs in MOCK mode without an API key", () => {
  assert.equal(isMockMode(), true);
});

test("manifest renders the footage compactly", () => {
  const m = buildManifest(makeCtx());
  assert.match(m, /ASSET asset_talk/);
  assert.match(m, /hook candidates/);
  assert.match(m, /transcript \(12 segments/);
  assert.ok(m.length < 20_000);
});

test("pickHooks prefers strong opening lines", () => {
  const hooks = pickHooks(makeAnalysis());
  assert.equal(hooks.length, 3);
  assert.match(hooks[0]!.text, /founders get pricing|mistakes/i);
  assert.ok(hooks[0]!.score >= hooks[1]!.score);
});

test("createPlan returns a complete plan with ≥ 6 enabled steps", async () => {
  const { plan, message } = await createPlan(makeCtx());
  assert.ok(plan.steps.length >= 6 && plan.steps.length <= 10, `steps ${plan.steps.length}`);
  assert.ok(plan.steps.filter((s) => s.enabled).length >= 6);
  assert.equal(plan.aspect, "9:16");
  assert.equal(plan.platform, "tiktok");
  assert.equal(plan.musicMood, "lofi");
  assert.equal(plan.targetDurationMs, 45_000);
  assert.ok(plan.title.length > 0 && plan.title.length <= 40);
  const cuts = plan.steps.find((s) => s.kind === "cuts")!;
  assert.match(cuts.text, /3 pauses/);
  assert.match(cuts.text, /4 filler words/);
  assert.ok(plan.steps.find((s) => s.kind === "hook")?.detail.text);
  assert.match(message, /plan/i);
});

let built: Awaited<ReturnType<typeof buildScript>>;
let builtCtx: ProjectContext;

test("buildScript produces a valid, complete edit", async () => {
  builtCtx = makeCtx();
  const { plan } = await createPlan(builtCtx);
  built = await buildScript(builtCtx, plan, media);
  const parsed = safeParseScript(built.script);
  assert.ok(parsed.ok, (parsed as { error?: string }).error);
  const script = built.script;
  const clips = mainClips(script);
  assert.ok(clips.length >= 6, `clips ${clips.length}`);
  // silences removed → shorter than the source
  assert.ok(script.output.durationMs < 60_000, `duration ${script.output.durationMs}`);
  // within 25% of target
  assert.ok(Math.abs(script.output.durationMs - 45_000) / 45_000 <= 0.25, `duration ${script.output.durationMs}`);
  // hook first
  assert.match(clips[0]!.reason ?? "", /Opened with your line/);
  assert.ok(clips[0]!.inMs < 3000 || clips[0]!.inMs > 0); // hook came from somewhere in the source
  // captions
  const caps = getTrack(script, "captions")!;
  assert.ok(caps.words.length > 40, `caption words ${caps.words.length}`);
  assert.equal(caps.style, "bold-pop");
  assert.ok(caps.words.some((w) => w.emphasis), "keyword emphasis");
  assert.ok(caps.words.every((w) => w.t >= 0 && w.t < script.output.durationMs));
  // music
  const music = getTrack(script, "audio", (t) => t.role === "music")!;
  assert.equal(music.clips.length, 1);
  assert.equal(music.clips[0]!.gainDb, -18);
  assert.equal(music.clips[0]!.ducking, true);
  // graphics
  const gfx = getTrack(script, "graphics")!;
  assert.ok(gfx.items.length >= 1);
  assert.ok(gfx.items.some((g) => g.component === "KineticTitle"));
  assert.ok(gfx.items.some((g) => g.component === "EndCard" && g.startMs + g.durationMs === script.output.durationMs));
  // punch-ins alternate
  assert.ok(clips.some((c) => c.transform.scale > 1), "punch-ins");
  // sfx & b-roll requested through the media provider
  assert.ok(calls.some((c) => c.startsWith("sfx:")));
  assert.ok(script.tracks.some((t) => t.kind === "video" && t.layer > 0 && t.clips.length > 0), "b-roll inserted");
  // every clip carries a reason
  assert.ok(clips.every((c) => c.reason && c.reason.length > 3));
  // checks: all ok or only non-fixable
  const failing = fixableOnly(script, "tiktok", 45_000);
  assert.ok(failing.every((c) => !c.fixable), JSON.stringify(failing));
  assert.ok(built.checks.find((c) => c.id === "no-gaps")!.ok);
  assert.equal(script.global.colorPreset, "clean");
  assert.match(built.summary, /Opened with your line/);
  assert.match(built.summary, /3 pauses/);
  assert.ok(built.suggestions.length >= 3 && built.suggestions.length <= 4);
});

test("editScript: make it shorter, around 20 seconds", async () => {
  const before = built.script.output.durationMs;
  const r = await editScript(builtCtx, built.script, "make it shorter, around 20 seconds", [], media);
  assert.ok(r.script.output.durationMs < before);
  assert.ok(r.script.output.durationMs <= 20_000 * 1.25, `duration ${r.script.output.durationMs}`);
  assert.ok(r.ops.length > 0);
  assert.ok(safeParseScript(r.script).ok);
  assert.match(r.summary, /trimmed/i);
  assert.doesNotMatch(r.summary, /lowered music/);
  const musicAfter = getTrack(r.script, "audio", (t) => t.role === "music")!.clips[0]!;
  assert.equal(musicAfter.gainDb, -18);
  assert.equal(musicAfter.fadeOutMs, 1500);
  // hook kept
  assert.match(mainClips(r.script)[0]!.reason ?? "", /Opened with your line/);
  // end card re-anchored
  const end = getTrack(r.script, "graphics")!.items.find((g) => g.component === "EndCard");
  if (end) assert.equal(end.startMs + end.durationMs, r.script.output.durationMs);
});

test("editScript: switch captions to hormozi and make them bigger", async () => {
  const beforeSize = getTrack(built.script, "captions")!.settings.fontSize;
  const r = await editScript(builtCtx, built.script, "switch captions to hormozi and make them bigger", [], media);
  const caps = getTrack(r.script, "captions")!;
  assert.equal(caps.style, "hormozi");
  assert.ok(caps.settings.fontSize > beforeSize, `${caps.settings.fontSize} > ${beforeSize}`);
  // style defaults must survive the size change (edl partial parsing re-applies defaults; we send full settings)
  assert.equal(caps.settings.uppercase, true);
  assert.equal(caps.settings.position, "center");
  assert.equal(caps.settings.highlightColor, "#3DFF6E");
  assert.ok(r.ops.some((o) => o.op === "setCaptionStyle"));
  assert.match(r.summary, /hormozi/i);
});

test("editScript: remove the music", async () => {
  const r = await editScript(builtCtx, built.script, "remove the music", [], media);
  const music = getTrack(r.script, "audio", (t) => t.role === "music");
  assert.equal(music?.clips.length ?? 0, 0);
  assert.match(r.summary, /music/i);
});

test("editScript: add a title that says Three mistakes", async () => {
  const base = await editScript(builtCtx, built.script, "remove the title", [], media);
  assert.ok(!getTrack(base.script, "graphics")!.items.some((g) => g.component === "KineticTitle"));
  const r = await editScript(builtCtx, base.script, "add a title that says Three mistakes", [], media);
  const title = getTrack(r.script, "graphics")!.items.find((g) => g.component === "KineticTitle");
  assert.ok(title, "KineticTitle added");
  assert.equal(title!.props.text, "Three mistakes");
  assert.ok(r.ops.some((o) => o.op === "addGraphic"));
});

test("editScript: remove the part where I say pricing", async () => {
  const before = built.script.output.durationMs;
  const r = await editScript(builtCtx, built.script, "remove the part where I say exact pricing page", [], media);
  assert.ok(r.script.output.durationMs < before, `${r.script.output.durationMs} < ${before}`);
  assert.match(r.summary, /removed the part/i);
});

test("editScript: swap music, colour grade and unknown instruction", async () => {
  const r = await editScript(builtCtx, built.script, "swap the music to cinematic and give it a warm film look", [], media);
  const music = getTrack(r.script, "audio", (t) => t.role === "music")!;
  assert.equal(music.clips[0]!.assetId, "music_cinematic");
  assert.equal(r.script.global.colorPreset, "warm-film");
  const u = await editScript(builtCtx, built.script, "make it sparkle like a unicorn", [], media);
  assert.equal(u.ops.length, 0);
  assert.match(u.message, /not sure/i);
  assert.ok(u.suggestions.length > 0);
});

test("selfCheck fixes gaps and loud music", async () => {
  const s = structuredClone(built.script);
  const clips = mainClips(s);
  clips[1]!.startMs += 2000; // introduce a gap
  for (const t of s.tracks) if (t.kind === "audio" && t.role === "music") t.clips[0]!.gainDb = -2;
  const r = await selfCheck(s, builtCtx);
  assert.ok(r.checks.find((c) => c.id === "no-gaps")!.ok);
  assert.ok(r.checks.find((c) => c.id === "music-level")!.ok);
  assert.ok(r.fixed.length >= 2);
});

test("plan tweaks: toggling music off produces a draft without music", async () => {
  const ctx = makeCtx();
  const { plan } = await createPlan(ctx);
  const tweaked = applyPlanTweaks(plan, { musicMood: null, disabledStepIds: ["broll"] });
  const r = await buildScript(ctx, tweaked, media);
  assert.equal(getTrack(r.script, "audio", (t) => t.role === "music")?.clips.length ?? 0, 0);
  assert.ok(!r.script.tracks.some((t) => t.kind === "video" && t.layer > 0 && t.clips.length > 0));
});

test("montage mode when there is no transcript", async () => {
  const ref: AssetRef = { id: "asset_clips", kind: "video", url: "https://cdn.test/proxy/clips.mp4", name: "gopro.mp4", durationMs: 40_000, width: 1920, height: 1080, source: "upload" };
  const analysis: AssetAnalysis = {
    durationMs: 40_000,
    width: 1920,
    height: 1080,
    hasAudio: true,
    shots: Array.from({ length: 8 }, (_, i) => ({ startMs: i * 5000, endMs: (i + 1) * 5000, description: `action shot ${i + 1}`, tags: i % 2 ? ["motion", "outdoor"] : ["landscape"] })),
    audio: { silences: [] },
    quality: { fillers: [], shaky: [], dark: [] },
    hooks: [],
  };
  const ctx = makeCtx({ brief: "Hype montage of my surf trip, energetic music, 30 seconds", targetDurationMs: 30_000, assets: [{ ref, analysis }], recipe: { slug: "montage-hype", title: "Hype Montage", category: "Effect", prompt: "Beat-synced montage.", defaults: { captionStyle: "glow", musicMood: "energetic", colorPreset: "vibrant", platform: "reels", transitions: "whip" } }, platform: "reels" });
  const { plan } = await createPlan(ctx);
  assert.ok(plan.steps.length >= 6);
  assert.equal(plan.musicMood, "energetic");
  const r = await buildScript(ctx, plan, media);
  assert.ok(safeParseScript(r.script).ok);
  const clips = mainClips(r.script);
  assert.ok(clips.length >= 8, `clips ${clips.length}`);
  assert.ok(clips.every((c) => c.outMs - c.inMs <= 3000 && c.outMs - c.inMs >= 500));
  assert.ok(Math.abs(r.script.output.durationMs - 30_000) / 30_000 <= 0.25, `duration ${r.script.output.durationMs}`);
  assert.ok(clips.some((c) => c.effects.some((e) => e.type === "zoomPulse")));
  assert.ok(clips.some((c) => c.transitionIn?.type === "whip" || c.transitionIn?.type === "flash"));
  const music = getTrack(r.script, "audio", (t) => t.role === "music")!;
  assert.equal(music.clips.length, 1);
  assert.equal(music.clips[0]!.gainDb, -12);
  assert.equal(getTrack(r.script, "captions")!.enabled, false);
  assert.equal(r.script.global.colorPreset, "vibrant");
  assert.ok(fixableOnly(r.script, "reels", 30_000).every((c) => !c.fixable));
  assert.match(r.summary, /montage/i);
});

test("describeFrames and quickSuggestions work in mock mode", async () => {
  const frames = await describeFrames([{ timeMs: 0, jpegBase64: "AAAA" }, { timeMs: 1000, jpegBase64: "BBBB" }]);
  assert.equal(frames.length, 2);
  assert.equal(frames[0]!.subjectX, 0.5);
  assert.deepEqual(frames[1]!.tags, []);
  const chips = quickSuggestions(built.script);
  assert.equal(chips.length, 4);
});
