/** Small shared helpers for the pipeline jobs. */
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env, scratchDir, updateJob } from "@vibe/core";
import type { AssetKind, AssetSource, Prisma } from "@vibe/db";
import { FFPROBE } from "@vibe/media";
import type { AssetRef } from "@vibe/edl";

export const execFileP = promisify(execFile);

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : JSON.stringify(e);
}

export function log(scope: string, ...args: unknown[]) {
  console.log(`[pipeline:${scope}]`, ...args);
}

/** A fresh scratch directory under DATA_DIR/tmp (cleaned up by the cleanup job). */
export async function jobScratch(name: string): Promise<string> {
  return scratchDir(`${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
}

export async function rmrf(p: string | null | undefined) {
  if (!p) return;
  await fsp.rm(p, { recursive: true, force: true }).catch(() => {});
}

export async function fileSize(p: string): Promise<number> {
  const st = await fsp.stat(p);
  return st.size;
}

/** Throttled progress reporter: writes to the Job row at most every `minIntervalMs` unless the message changes. */
export function progressReporter(jobId: string, minIntervalMs = 700) {
  let last = 0;
  let lastMessage: string | undefined;
  let pending: Promise<unknown> | null = null;
  const report = async (progress: number, message?: string, force = false) => {
    const now = Date.now();
    const changed = message !== undefined && message !== lastMessage;
    if (!force && !changed && now - last < minIntervalMs) return;
    last = now;
    if (message !== undefined) lastMessage = message;
    const patch: { progress: number; message?: string } = { progress };
    if (message !== undefined) patch.message = message;
    pending = updateJob(jobId, patch).catch((e) => log("progress", "failed to update job", errorMessage(e)));
    await pending;
  };
  return report;
}
export type ProgressFn = ReturnType<typeof progressReporter>;

export function assetKindToRef(kind: AssetKind): AssetRef["kind"] {
  return kind === "VIDEO" ? "video" : kind === "AUDIO" ? "audio" : "image";
}

export function assetSourceToRef(source: AssetSource): AssetRef["source"] {
  switch (source) {
    case "STOCK":
      return "stock";
    case "GENERATED":
      return "generated";
    case "BRAND":
      return "brand";
    case "LIBRARY":
      return "library";
    default:
      return "upload";
  }
}

export function mimeForExt(ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    json: "application/json",
    srt: "application/x-subrip",
  };
  return map[e] ?? "application/octet-stream";
}

export function extForMime(mime: string, fallback = "bin"): string {
  const map: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mime.split(";")[0]!.trim().toLowerCase()] ?? fallback;
}

/** Width/height of an image (the @vibe/media ffprobe helper ignores mjpeg/png streams on purpose). */
export async function probeImage(file: string): Promise<{ width?: number; height?: number }> {
  const { stdout } = await execFileP(FFPROBE, ["-v", "error", "-print_format", "json", "-show_streams", file]);
  const json = JSON.parse(stdout) as { streams?: Array<{ codec_type?: string; width?: number; height?: number }> };
  const v = json.streams?.find((s) => s.codec_type === "video");
  return { width: v?.width, height: v?.height };
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function slug(s: string, max = 40) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max) || "x";
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function tmpRoot() {
  return path.join(env.dataDir, "tmp");
}

/** Cast structured data for Prisma Json columns (zod-inferred types lack an index signature). */
export function json<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
