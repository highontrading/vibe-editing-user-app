/**
 * End-to-end render smoke test for @vibe/compositions.
 *
 *   pnpm --filter @vibe/compositions exec tsx src/render-smoke.ts
 *
 * - generates a 4 s test clip + a sine "music" track with ffmpeg
 * - serves them over a local HTTP server (like signed URLs in production)
 * - bundles src/entry.ts with @remotion/bundler
 * - renders 2 s of a script that exercises clips, a whip transition, zoomPulse,
 *   bold-pop captions, KineticTitle, EndCard, ProgressBar and ducked music
 * - renders 3 stills from that script, plus one still per caption style,
 *   graphic component and transition for visual inspection.
 *
 * Env: SMOKE_OUT_DIR (output folder), REMOTION_BROWSER_EXECUTABLE (chromium path),
 *      SMOKE_SKIP_GALLERY=1 to only run the main render.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition, type ChromiumOptions } from "@remotion/renderer";
import { CAPTION_STYLE_IDS, GRAPHIC_COMPONENT_IDS, TRANSITION_TYPES, emptyScript, parseScript, type EditScript } from "@vibe/edl";
import { COMPOSITION_ID } from "./EditScriptComposition";
import { captionPreviewScript, graphicPreviewScript, transitionPreviewScript } from "./previews";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.SMOKE_OUT_DIR ?? path.join(os.tmpdir(), "vibe-compositions-smoke");
fs.mkdirSync(outDir, { recursive: true });
const mediaDir = path.join(outDir, "media");
fs.mkdirSync(mediaDir, { recursive: true });

const log = (...args: unknown[]) => console.log(`[smoke ${new Date().toISOString().slice(11, 19)}]`, ...args);

function ffmpeg(args: string[]) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
}

function generateMedia() {
  const clip = path.join(mediaDir, "test-clip.mp4");
  const music = path.join(mediaDir, "music.wav");
  if (!fs.existsSync(clip)) {
    log("generating test clip");
    ffmpeg(["-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30:duration=4", "-f", "lavfi", "-i", "sine=f=440:d=4", "-shortest", "-pix_fmt", "yuv420p", clip]);
  }
  if (!fs.existsSync(music)) {
    log("generating music");
    ffmpeg(["-f", "lavfi", "-i", "sine=f=220:d=4", "-f", "lavfi", "-i", "sine=f=330:d=4", "-filter_complex", "amix=inputs=2", "-c:a", "pcm_s16le", music]);
  }
}

const MIME: Record<string, string> = { ".mp4": "video/mp4", ".wav": "audio/wav", ".png": "image/png", ".jpg": "image/jpeg" };

function serve(dir: string): Promise<{ baseUrl: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(dir, decodeURIComponent((req.url ?? "/").split("?")[0]));
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      const size = fs.statSync(file).size;
      const type = MIME[path.extname(file)] ?? "application/octet-stream";
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m && m[1] ? Number(m[1]) : 0;
        const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
        res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Access-Control-Allow-Origin": "*" });
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ baseUrl: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

function buildSmokeScript(baseUrl: string): EditScript {
  const s = emptyScript({ width: 720, height: 1280, fps: 30, platform: "tiktok", title: "Smoke" });
  s.assets.clip = { id: "clip", kind: "video", url: `${baseUrl}/test-clip.mp4`, name: "Test clip", durationMs: 4000, width: 1280, height: 720, source: "upload" };
  s.assets.music = { id: "music", kind: "audio", url: `${baseUrl}/music.wav`, name: "Sine music", durationMs: 4000, source: "library" };
  s.assets.missing = { id: "missing", kind: "image", url: `${baseUrl}/does-not-exist.png`, name: "Broken asset", source: "upload" };
  const main = s.tracks.find((t) => t.kind === "video");
  if (main && main.kind === "video") {
    main.clips.push(
      { id: "a", assetId: "clip", startMs: 0, inMs: 0, outMs: 1500, speed: 1, volume: 1, transform: { scale: 1, x: 0, y: 0, rotate: 0 }, effects: [{ type: "zoomPulse", params: { amount: 0.1, bpm: 120 } }, { type: "colorGrade", params: { preset: "warm-film" } }], label: "A" },
      { id: "b", assetId: "clip", startMs: 1500, inMs: 2000, outMs: 4000, speed: 1, volume: 1, transform: { scale: 1, x: 0, y: 0, rotate: 0 }, effects: [{ type: "vignette", params: { amount: 0.6 } }], transitionIn: { type: "whip", durationMs: 300 }, label: "B" },
    );
  }
  s.tracks.push({
    id: "broll",
    kind: "video",
    layer: 1,
    name: "B-roll",
    clips: [{ id: "pip", assetId: "missing", startMs: 2000, inMs: 0, outMs: 800, speed: 1, volume: 0, transform: { scale: 0.4, x: 150, y: -350, rotate: 0 }, effects: [], transitionIn: { type: "crossfade", durationMs: 200 } }],
  });
  const words = "make videos that actually get watched by real people".split(" ");
  const cap = s.tracks.find((t) => t.kind === "captions");
  if (cap && cap.kind === "captions") {
    cap.style = "bold-pop";
    cap.settings = { ...cap.settings, fontSize: 60, position: "center", uppercase: true, mode: "word", animation: "pop", maxWordsPerLine: 3, highlightColor: "#FFD400", emoji: true, color: "#FFFFFF", offset: 0.25 };
    cap.words = words.map((w, i) => ({ t: 200 + i * 330, d: 300, text: w, emphasis: w === "actually", emoji: w === "watched" ? "👀" : undefined }));
  }
  s.tracks.push({
    id: "gfx",
    kind: "graphics",
    name: "Graphics",
    items: [
      { id: "title", component: "KineticTitle", startMs: 100, durationMs: 1400, props: { text: "Stop scrolling", subtitle: "watch this", style: "slam", align: "top" } },
      { id: "bar", component: "ProgressBar", startMs: 0, durationMs: 0, props: { position: "top", thickness: 10 } },
      { id: "end", component: "EndCard", startMs: 2600, durationMs: 900, props: { headline: "Follow for more", handle: "vibe" } },
    ],
  });
  s.tracks.push({ id: "music", kind: "audio", role: "music", muted: false, name: "Music", clips: [{ id: "m1", assetId: "music", startMs: 0, inMs: 0, gainDb: -8, fadeInMs: 300, fadeOutMs: 500, ducking: true, loop: true }] });
  s.global = { colorPreset: "none", grain: 0.25, vignette: 0.2 };
  s.meta.notes = "[watermark] smoke";
  return parseScript(s);
}

async function main() {
  generateMedia();
  const { baseUrl, close } = await serve(mediaDir);
  log("serving media at", baseUrl);

  const fallbackChromium = "/opt/pw-browsers/chromium";
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? (fs.existsSync(fallbackChromium) ? fallbackChromium : undefined);
  const chromiumOptions: ChromiumOptions = browserExecutable ? { gl: "swangle" } : {};
  log("browser:", browserExecutable ?? "(remotion managed)");

  log("bundling");
  const serveUrl = await bundle({ entryPoint: path.join(here, "entry.ts"), outDir: path.join(outDir, "bundle"), onProgress: () => undefined });
  log("bundle at", serveUrl);

  const browser = await openBrowser("chrome", { browserExecutable, chromiumOptions, shouldDumpIo: false });
  const common = { serveUrl, puppeteerInstance: browser, chromiumOptions, browserExecutable, timeoutInMilliseconds: 90_000 } as const;

  try {
    const script = buildSmokeScript(baseUrl);
    const inputProps = { script, watermark: true };
    const composition = await selectComposition({ ...common, id: COMPOSITION_ID, inputProps });
    log("composition", composition.width, "x", composition.height, "@", composition.fps, "fps,", composition.durationInFrames, "frames");

    const videoOut = path.join(outDir, "smoke.mp4");
    let lastPct = -1;
    await renderMedia({
      ...common,
      composition,
      inputProps,
      codec: "h264",
      outputLocation: videoOut,
      frameRange: [0, 59],
      concurrency: 2,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct !== lastPct) {
          lastPct = pct;
          log(`render ${pct}%`);
        }
      },
    });
    log("video written", videoOut, `${(fs.statSync(videoOut).size / 1024).toFixed(0)} KB`);

    for (const frame of [20, 48, 85]) {
      const output = path.join(outDir, `smoke-f${frame}.png`);
      await renderStill({ ...common, composition, inputProps, frame, output, imageFormat: "png" });
      log("still", output);
    }

    if (process.env.SMOKE_SKIP_GALLERY !== "1") {
      const galleryDir = path.join(outDir, "gallery");
      fs.mkdirSync(galleryDir, { recursive: true });
      const still = async (name: string, s: EditScript, frame: number) => {
        const props = { script: s, watermark: false };
        const comp = await selectComposition({ ...common, id: COMPOSITION_ID, inputProps: props });
        const output = path.join(galleryDir, `${name}.png`);
        await renderStill({ ...common, composition: comp, inputProps: props, frame: Math.min(frame, comp.durationInFrames - 1), output, imageFormat: "png", scale: 0.4 });
        log("gallery", name);
      };
      for (const style of CAPTION_STYLE_IDS) await still(`caption-${style}`, captionPreviewScript(style), 56);
      for (const id of GRAPHIC_COMPONENT_IDS) await still(`graphic-${id}`, graphicPreviewScript(id), 40);
      for (const type of TRANSITION_TYPES) await still(`transition-${type}`, transitionPreviewScript(type), 46);
    }
    log("done. output in", outDir);
  } finally {
    await browser.close({ silent: true });
    close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
