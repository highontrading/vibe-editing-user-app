/**
 * Remotion glue: bundles @vibe/compositions once per process, picks a browser,
 * serves local storage files to the headless browser, and renders scripts.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { env, getStorage } from "@vibe/core";
import { COMPOSITION_ID } from "@vibe/compositions";
import type { EditScript } from "@vibe/edl";
import { resolveScriptAssets } from "./assets";
import { log, mimeForExt } from "./util";

type RendererModule = typeof import("@remotion/renderer");

export const DEFAULT_BROWSER_FALLBACK = "/opt/pw-browsers/chromium";

/* ------------------------------ bundle -------------------------------- */

function compositionsEntry(): string {
  try {
    const require = createRequire(import.meta.url);
    return require.resolve("@vibe/compositions/entry");
  } catch {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../compositions/src/entry.ts");
  }
}

let bundlePromise: Promise<string> | null = null;

/** Webpack-bundles the compositions package once; later calls reuse the directory. */
export function getBundle(onProgress?: (p: number) => void): Promise<string> {
  if (!bundlePromise) {
    const started = Date.now();
    bundlePromise = (async () => {
      const { bundle } = await import("@remotion/bundler");
      const entryPoint = compositionsEntry();
      log("renderer", "bundling compositions from", entryPoint);
      const dir = await bundle({ entryPoint, webpackOverride: (c) => c, onProgress: onProgress ?? (() => {}) });
      log("renderer", `bundle ready in ${((Date.now() - started) / 1000).toFixed(1)}s at ${dir}`);
      return dir;
    })();
    bundlePromise.catch(() => {
      bundlePromise = null; // allow a retry on the next render
    });
  }
  return bundlePromise;
}

/* ------------------------------ browser ------------------------------- */

export interface BrowserConfig {
  browserExecutable?: string;
  chromeMode?: "headless-shell" | "chrome-for-testing";
  chromiumOptions: { gl?: "swangle" | "angle" | "egl" | "swiftshader" | "vulkan" | "angle-egl"; headless?: boolean };
}

let browserPromise: Promise<BrowserConfig> | null = null;

async function exists(p: string) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Browser used for rendering:
 *  1. REMOTION_BROWSER_EXECUTABLE if set (full Chrome / Chrome for Testing)
 *  2. Remotion's own Chrome Headless Shell (downloaded on first use)
 *  3. fallback: /opt/pw-browsers/chromium (Playwright's Chrome for Testing) with the SwANGLE GL backend
 * When the fallback binary exists we skip the download attempt: it needs
 * network access and an aborted download can take the process down.
 */
export function getBrowserConfig(): Promise<BrowserConfig> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const explicit = process.env.REMOTION_BROWSER_EXECUTABLE;
      const fallback = explicit || DEFAULT_BROWSER_FALLBACK;
      const fallbackConfig: BrowserConfig = { browserExecutable: fallback, chromeMode: "chrome-for-testing", chromiumOptions: { gl: "swangle" } };
      if (explicit) return fallbackConfig;
      if (await exists(fallback)) {
        log("renderer", "using browser", fallback);
        return fallbackConfig;
      }
      try {
        const { ensureBrowser } = (await import("@remotion/renderer")) as RendererModule;
        const status = await ensureBrowser();
        log("renderer", "remotion browser", status.type);
        return { chromiumOptions: {} };
      } catch (e) {
        log("renderer", "remotion browser download failed:", (e as Error).message);
        throw new Error(`No browser for rendering. Install Chrome and set REMOTION_BROWSER_EXECUTABLE (tried ${fallback}).`);
      }
    })();
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

/* --------------------------- local asset server ----------------------- */

let serverPromise: Promise<{ baseUrl: string; close: () => void }> | null = null;

/**
 * Serves the local storage directory over HTTP (with Range support) so the
 * headless browser can load proxies/music without the web app running.
 */
export function getLocalAssetServer(): Promise<{ baseUrl: string; close: () => void }> {
  if (!serverPromise) {
    serverPromise = new Promise((resolve, reject) => {
      const storage = getStorage();
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url ?? "/", "http://127.0.0.1");
          const key = decodeURIComponent(url.pathname).replace(/^\/+/, "");
          const file = storage.localPath(key);
          if (!file) {
            res.writeHead(404).end();
            return;
          }
          const stat = await fsp.stat(file).catch(() => null);
          if (!stat || !stat.isFile()) {
            res.writeHead(404).end();
            return;
          }
          const headers: Record<string, string> = {
            "Content-Type": mimeForExt(path.extname(file)),
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
          };
          const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
          if (range) {
            const start = range[1] ? Number(range[1]) : 0;
            const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
            if (start >= stat.size) {
              res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end();
              return;
            }
            headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
            headers["Content-Length"] = String(end - start + 1);
            res.writeHead(206, headers);
            if (req.method === "HEAD") return void res.end();
            fs.createReadStream(file, { start, end }).pipe(res);
            return;
          }
          headers["Content-Length"] = String(stat.size);
          res.writeHead(200, headers);
          if (req.method === "HEAD") return void res.end();
          fs.createReadStream(file).pipe(res);
        } catch (e) {
          res.writeHead(500).end(String(e));
        }
      });
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        server.unref();
        resolve({ baseUrl: `http://127.0.0.1:${port}`, close: () => server.close() });
      });
    });
    serverPromise.catch(() => {
      serverPromise = null;
    });
  }
  return serverPromise;
}

/** Script whose asset URLs the headless browser can fetch from this machine. */
export async function prepareScriptForRender(script: EditScript): Promise<EditScript> {
  if (getStorage().driver === "local") {
    const { baseUrl } = await getLocalAssetServer();
    return resolveScriptAssets(script, { baseUrl });
  }
  return resolveScriptAssets(script, { expiresInSec: 12 * 3600 });
}

/* ------------------------------ rendering ----------------------------- */

export function renderConcurrency(): number {
  const fromEnv = Number(process.env.REMOTION_CONCURRENCY);
  if (fromEnv > 0) return fromEnv;
  return Math.max(1, Math.min(4, os.cpus().length - 1));
}

export function crfForQuality(quality: string): number {
  switch (quality) {
    case "4k":
      return 18;
    case "1080p":
      return 20;
    case "720p":
      return 23;
    default:
      return 21;
  }
}

export interface RenderOptions {
  outputFile: string;
  watermark?: boolean;
  scale?: number;
  crf?: number;
  onProgress?: (fraction: number, renderedFrames: number, totalFrames: number) => void;
}

async function selectScriptComposition(serveUrl: string, inputProps: Record<string, unknown>) {
  const { selectComposition } = (await import("@remotion/renderer")) as RendererModule;
  const browser = await getBrowserConfig();
  return selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
    browserExecutable: browser.browserExecutable,
    chromeMode: browser.chromeMode,
    chromiumOptions: browser.chromiumOptions,
    logLevel: "error",
  });
}

/** Render a (URL-resolved) script to an H.264 mp4. */
export async function renderScriptToFile(script: EditScript, opts: RenderOptions): Promise<{ durationInFrames: number; fps: number }> {
  const { renderMedia } = (await import("@remotion/renderer")) as RendererModule;
  const serveUrl = await getBundle();
  const browser = await getBrowserConfig();
  const inputProps = { script, watermark: opts.watermark ?? false };
  const composition = await selectScriptComposition(serveUrl, inputProps);
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    crf: opts.crf ?? 20,
    imageFormat: "jpeg",
    jpegQuality: 90,
    scale: opts.scale ?? 1,
    concurrency: renderConcurrency(),
    outputLocation: opts.outputFile,
    overwrite: true,
    enforceAudioTrack: true,
    browserExecutable: browser.browserExecutable,
    chromeMode: browser.chromeMode,
    chromiumOptions: browser.chromiumOptions,
    logLevel: "error",
    onProgress: (p) => opts.onProgress?.(p.progress, p.renderedFrames, composition.durationInFrames),
  });
  return { durationInFrames: composition.durationInFrames, fps: composition.fps };
}

/** Render one still (JPEG) of the script at `timeMs`, resized to `width` px wide. */
export async function renderScriptStill(script: EditScript, opts: { outputFile: string; timeMs: number; width?: number; watermark?: boolean }): Promise<void> {
  const { renderStill } = (await import("@remotion/renderer")) as RendererModule;
  const serveUrl = await getBundle();
  const browser = await getBrowserConfig();
  const inputProps = { script, watermark: opts.watermark ?? false };
  const composition = await selectScriptComposition(serveUrl, inputProps);
  const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor((opts.timeMs / 1000) * composition.fps)));
  const scale = opts.width ? Math.min(1, opts.width / composition.width) : 1;
  await renderStill({
    serveUrl,
    composition,
    inputProps,
    frame,
    output: opts.outputFile,
    imageFormat: "jpeg",
    jpegQuality: 85,
    scale,
    overwrite: true,
    browserExecutable: browser.browserExecutable,
    chromeMode: browser.chromeMode,
    chromiumOptions: browser.chromiumOptions,
    logLevel: "error",
  });
}

/** Pre-bundle the compositions and locate a browser so the first render is fast. Never throws. */
export async function warmRenderer(): Promise<{ bundled: boolean; browser: boolean }> {
  const out = { bundled: false, browser: false };
  try {
    await getBundle();
    out.bundled = true;
  } catch (e) {
    log("renderer", "warm bundle failed:", (e as Error).message);
  }
  try {
    await getBrowserConfig();
    out.browser = true;
  } catch (e) {
    log("renderer", "warm browser failed:", (e as Error).message);
  }
  return out;
}
