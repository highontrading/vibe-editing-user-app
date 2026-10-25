import { execa } from "execa";
import fsp from "node:fs/promises";
import path from "node:path";

export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export interface ProbeResult {
  durationMs: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  codec?: string;
  audioCodec?: string;
  rotation?: number;
  bitrate?: number;
  sizeBytes?: number;
}

export async function ffprobe(file: string): Promise<ProbeResult> {
  const { stdout } = await execa(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  const json = JSON.parse(stdout) as { format?: { duration?: string; bit_rate?: string; size?: string }; streams?: Array<Record<string, unknown>> };
  const streams = json.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video" && s.codec_name !== "mjpeg" && s.codec_name !== "png");
  const a = streams.find((s) => s.codec_type === "audio");
  let fps: number | undefined;
  const rate = (v?.avg_frame_rate as string | undefined) || (v?.r_frame_rate as string | undefined);
  if (rate && rate.includes("/")) {
    const [n, d] = rate.split("/").map(Number);
    if (n && d) fps = Math.round((n / d) * 100) / 100;
  }
  let rotation = 0;
  const sd = v?.side_data_list as Array<{ rotation?: number }> | undefined;
  if (sd?.[0]?.rotation) rotation = Number(sd[0].rotation);
  const tags = v?.tags as { rotate?: string } | undefined;
  if (tags?.rotate) rotation = Number(tags.rotate);
  let width = v?.width as number | undefined;
  let height = v?.height as number | undefined;
  if (Math.abs(rotation) === 90 || Math.abs(rotation) === 270) [width, height] = [height, width];
  const durationSec = Number(json.format?.duration ?? (v?.duration as string) ?? (a?.duration as string) ?? 0);
  return {
    durationMs: Math.round(durationSec * 1000),
    width,
    height,
    fps,
    hasAudio: !!a,
    hasVideo: !!v,
    codec: v?.codec_name as string | undefined,
    audioCodec: a?.codec_name as string | undefined,
    rotation,
    bitrate: json.format?.bit_rate ? Number(json.format.bit_rate) : undefined,
    sizeBytes: json.format?.size ? Number(json.format.size) : undefined,
  };
}

export interface RunOpts {
  onProgress?: (p: { frame?: number; timeMs?: number; speed?: string }) => void;
  cwd?: string;
  timeoutMs?: number;
}

/** Run ffmpeg with the given args (without the binary name). Parses -progress output when onProgress is given. */
export async function ffmpeg(args: string[], opts: RunOpts = {}): Promise<void> {
  const full = ["-hide_banner", "-y", "-nostdin", ...(opts.onProgress ? ["-progress", "pipe:1", "-loglevel", "error"] : ["-loglevel", "error"]), ...args];
  const proc = execa(FFMPEG, full, { cwd: opts.cwd, timeout: opts.timeoutMs, all: true, buffer: !opts.onProgress });
  if (opts.onProgress && proc.stdout) {
    let buf = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      const p: { frame?: number; timeMs?: number; speed?: string } = {};
      for (const line of lines) {
        const [k, v] = line.split("=");
        if (k === "frame") p.frame = Number(v);
        if (k === "out_time_us" || k === "out_time_ms") p.timeMs = Math.round(Number(v) / 1000);
        if (k === "speed") p.speed = v;
      }
      if (p.frame !== undefined || p.timeMs !== undefined) opts.onProgress!(p);
    });
  }
  try {
    await proc;
  } catch (e) {
    const err = e as { all?: string; stderr?: string; message: string };
    throw new Error(`ffmpeg failed: ${(err.all || err.stderr || err.message || "").slice(-2000)}`);
  }
}

/** 720p H.264 proxy for fast preview/scrubbing. Keeps aspect, caps the long edge at 1280. */
export async function makeProxy(input: string, output: string, opts: RunOpts = {}) {
  await ffmpeg(
    ["-i", input, "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))',format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-ac", "2", output],
    opts,
  );
  return output;
}

/** Mono 16 kHz WAV for transcription. */
export async function extractAudio(input: string, output: string) {
  await ffmpeg(["-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", output]);
  return output;
}

/** Poster frame at timeMs. */
export async function extractFrame(input: string, output: string, timeMs: number, width = 640) {
  await ffmpeg(["-ss", (timeMs / 1000).toFixed(3), "-i", input, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "3", output]);
  return output;
}

/** Thumbnail strip: one frame every `everySec` seconds, tiled horizontally. Returns {path, count}. */
export async function thumbnailStrip(input: string, output: string, durationMs: number, everySec = 2, width = 160) {
  const count = Math.max(1, Math.min(120, Math.ceil(durationMs / 1000 / everySec)));
  await ffmpeg(["-i", input, "-vf", `fps=1/${everySec},scale=${width}:-2,tile=${count}x1`, "-frames:v", "1", "-q:v", "4", output]);
  return { path: output, count, everySec, width };
}

/** Extract N evenly spaced keyframes as JPEGs; returns their timestamps. */
export async function extractKeyframes(input: string, outDir: string, timesMs: number[], width = 960): Promise<{ timeMs: number; path: string }[]> {
  await fsp.mkdir(outDir, { recursive: true });
  const out: { timeMs: number; path: string }[] = [];
  for (let i = 0; i < timesMs.length; i++) {
    const t = timesMs[i]!;
    const file = path.join(outDir, `kf_${String(i).padStart(3, "0")}_${t}.jpg`);
    await extractFrame(input, file, t, width);
    out.push({ timeMs: t, path: file });
  }
  return out;
}

/** Scene cuts via ffmpeg's scene detection filter. Returns cut timestamps in ms. */
export async function detectScenes(input: string, threshold = 0.35): Promise<number[]> {
  const { stderr } = await execa(FFMPEG, ["-hide_banner", "-nostdin", "-i", input, "-vf", `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-"], { reject: false });
  const times: number[] = [];
  for (const m of stderr.matchAll(/pts_time:([0-9.]+)/g)) times.push(Math.round(Number(m[1]) * 1000));
  return times;
}

/** Silence spans via silencedetect. */
export async function detectSilences(input: string, noiseDb = -32, minSec = 0.45): Promise<{ startMs: number; endMs: number }[]> {
  const { stderr } = await execa(FFMPEG, ["-hide_banner", "-nostdin", "-i", input, "-af", `silencedetect=noise=${noiseDb}dB:d=${minSec}`, "-vn", "-f", "null", "-"], { reject: false });
  const out: { startMs: number; endMs: number }[] = [];
  let start: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = line.match(/silence_start: ([0-9.]+)/);
    const e = line.match(/silence_end: ([0-9.]+)/);
    if (s) start = Math.round(Number(s[1]) * 1000);
    if (e && start !== null) {
      out.push({ startMs: start, endMs: Math.round(Number(e[1]) * 1000) });
      start = null;
    }
  }
  return out;
}

/** Integrated loudness in LUFS using ebur128. */
export async function measureLoudness(input: string): Promise<number | undefined> {
  const { stderr } = await execa(FFMPEG, ["-hide_banner", "-nostdin", "-i", input, "-af", "ebur128=framelog=quiet", "-vn", "-f", "null", "-"], { reject: false });
  const m = stderr.match(/I:\s*(-?[0-9.]+) LUFS/);
  return m ? Number(m[1]) : undefined;
}

/** Waveform peaks (0-1) sampled `pointsPerSec` times per second, for the timeline. */
export async function waveformPeaks(input: string, pointsPerSec = 10): Promise<number[]> {
  const { stdout } = await execa(FFMPEG, ["-hide_banner", "-nostdin", "-loglevel", "error", "-i", input, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { encoding: "buffer", maxBuffer: 1024 * 1024 * 512 });
  const samples = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 2));
  const window = Math.floor(8000 / pointsPerSec);
  const peaks: number[] = [];
  for (let i = 0; i < samples.length; i += window) {
    let max = 0;
    for (let j = i; j < Math.min(i + window, samples.length); j++) {
      const v = Math.abs(samples[j]!);
      if (v > max) max = v;
    }
    peaks.push(Math.round((max / 32768) * 1000) / 1000);
  }
  return peaks;
}

/** Two-pass EBU R128 loudness normalisation + final platform encode. */
export async function normalizeLoudness(input: string, output: string, targetLufs = -14, opts: RunOpts = {}) {
  await ffmpeg(["-i", input, "-c:v", "copy", "-af", `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output], opts);
  return output;
}

/** Synthesize placeholder audio (used when no music/SFX provider is configured). */
export async function synthAudio(output: string, opts: { seconds: number; kind: "music" | "sfx"; mood?: string; sfxId?: string; bpm?: number }) {
  const { seconds, kind } = opts;
  if (kind === "sfx") {
    const id = opts.sfxId ?? "sfx-whoosh-1";
    let filter: string;
    if (id.includes("whoosh") || id.includes("swoosh")) filter = `anoisesrc=d=${seconds}:c=pink:a=0.6,highpass=f=300,lowpass=f=4000,afade=t=in:d=${seconds * 0.4},afade=t=out:st=${seconds * 0.4}:d=${seconds * 0.6}`;
    else if (id.includes("pop") || id.includes("click")) filter = `sine=f=900:d=${seconds},afade=t=out:d=${seconds},volume=0.8`;
    else if (id.includes("ding")) filter = `sine=f=1760:d=${seconds},afade=t=out:st=0.05:d=${Math.max(0.1, seconds - 0.05)}`;
    else if (id.includes("riser")) filter = `anoisesrc=d=${seconds}:c=white:a=0.4,lowpass=f=600,afade=t=in:d=${seconds}`;
    else if (id.includes("impact")) filter = `sine=f=55:d=${seconds},afade=t=out:d=${seconds},volume=1.2`;
    else if (id.includes("glitch")) filter = `anoisesrc=d=${seconds}:c=white:a=0.5,tremolo=f=30:d=1`;
    else if (id.includes("cash")) filter = `sine=f=2200:d=${seconds},tremolo=f=12:d=0.9,afade=t=out:d=${seconds}`;
    else filter = `sine=f=600:d=${seconds},afade=t=out:d=${seconds}`;
    await ffmpeg(["-f", "lavfi", "-i", filter, "-ar", "44100", "-ac", "2", output]);
    return output;
  }
  // Music: simple chord pad + soft kick at bpm so previews have rhythm.
  const bpm = opts.bpm ?? 100;
  const beat = 60 / bpm;
  const mood = opts.mood ?? "lofi";
  const base = mood === "dark" || mood === "cinematic" ? 110 : mood === "energetic" || mood === "upbeat" ? 220 : 165;
  const pad = `sine=f=${base}:d=${seconds},sine=f=${base * 1.25}:d=${seconds},sine=f=${base * 1.5}:d=${seconds}`;
  const filter = `${pad};[0][1][2]amix=inputs=3:normalize=0,lowpass=f=1200,tremolo=f=${(1 / beat / 2).toFixed(3)}:d=0.35,volume=0.25,afade=t=in:d=1,afade=t=out:st=${Math.max(0, seconds - 2)}:d=2[a];sine=f=60:d=${seconds},apulsator=hz=${(1 / beat).toFixed(3)}:width=0.1,volume=0.5[k];[a][k]amix=inputs=2:normalize=0`;
  await ffmpeg(["-f", "lavfi", "-i", `${filter}`, "-ar", "44100", "-ac", "2", "-t", String(seconds), output]).catch(async () => {
    await ffmpeg(["-f", "lavfi", "-i", `sine=f=${base}:d=${seconds},volume=0.2`, "-ar", "44100", "-ac", "2", output]);
  });
  return output;
}

export async function fileExists(p: string) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}
