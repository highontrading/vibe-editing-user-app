/**
 * MediaProvider for the agent: music, SFX, stock b-roll and voice.
 *
 *   music  -> ElevenLabs Music API when ELEVENLABS_API_KEY is set, else a synthesised placeholder (cached per mood+length)
 *   sfx    -> ElevenLabs sound generation when the key is set, else a synthesised placeholder (cached per sfx id)
 *   stock  -> Pexels (PEXELS_API_KEY) -> Pixabay (PIXABAY_API_KEY) -> MOCK clips/images drawn with ffmpeg
 *   voice  -> ElevenLabs TTS when the key is set, otherwise `generateVoice` is undefined
 *   image  -> not configured. To add fal.ai: define `generateImage` below, POST to
 *             https://fal.run/fal-ai/flux/schnell with { prompt, image_size } and header
 *             `Authorization: Key ${FAL_KEY}`, download `images[0].url`, then `storeGenerated(...)` like the voice path.
 *
 * Every returned AssetRef points at a storage KEY (`url`), has a matching Asset row (its id), and is
 * resolved to a real URL by resolveScriptAssets() at preview/render time.
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { env, getStorage, storageKeys } from "@vibe/core";
import { prisma, type Asset, type AssetKind, type AssetSource } from "@vibe/db";
import { ffmpeg, ffprobe, synthAudio } from "@vibe/media";
import { MUSIC_MOOD_INFO, SFX_LIBRARY, type AssetRef } from "@vibe/edl";
import type { MediaProvider } from "@vibe/agent";
import { assetRefFromRow } from "./context";
import { errorMessage, extForMime, jobScratch, log, mimeForExt, probeImage, rmrf, slug } from "./util";

const ELEVEN = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
const MOCK_SIZES = { portrait: { w: 720, h: 1280 }, landscape: { w: 1280, h: 720 }, square: { w: 720, h: 720 } } as const;

type Orientation = "portrait" | "landscape" | "square";

async function projectOwner(projectId: string): Promise<string> {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
  if (!p) throw new Error(`Project ${projectId} not found`);
  return p.userId;
}

interface StoreOpts {
  key: string;
  userId: string;
  projectId: string | null;
  kind: AssetKind;
  source: AssetSource;
  name: string;
  mime: string;
  attribution?: string;
  tags?: string[];
  /** Produce the file when it is not in storage yet. */
  make: (file: string) => Promise<void>;
  /** Reuse an existing Asset row for this user+key (library caching). */
  reuseRow?: boolean;
}

/** Ensure the file exists in storage (making it if needed) and that an Asset row points at it. */
async function storeAsset(opts: StoreOpts): Promise<Asset> {
  const storage = getStorage();
  const ext = path.extname(opts.key) || ".bin";
  let meta: { durationMs?: number; width?: number; height?: number; sizeBytes?: number } = {};
  const probe = async (file: string) => {
    const st = await fsp.stat(file);
    if (opts.kind === "IMAGE") {
      const { width, height } = await probeImage(file).catch(() => ({ width: undefined, height: undefined }));
      meta = { width, height, sizeBytes: st.size };
    } else {
      const info = await ffprobe(file).catch(() => null);
      meta = { durationMs: info?.durationMs, width: info?.width, height: info?.height, sizeBytes: st.size };
    }
  };
  if (opts.reuseRow) {
    const existing = await prisma.asset.findFirst({ where: { userId: opts.userId, storageKey: opts.key, status: "READY" } });
    if (existing && (await storage.exists(opts.key))) return existing;
  }
  if (!(await storage.exists(opts.key))) {
    const dir = await jobScratch("media");
    try {
      const file = path.join(dir, `media${ext}`);
      await opts.make(file);
      await probe(file);
      await storage.putFile(opts.key, file, opts.mime);
    } finally {
      await rmrf(dir);
    }
  } else {
    const lp = storage.localPath(opts.key);
    if (lp) await probe(lp).catch(() => {});
    else {
      const dir = await jobScratch("media");
      try {
        await probe(await storage.downloadToFile(opts.key, path.join(dir, `media${ext}`)));
      } catch {
        /* metadata optional */
      } finally {
        await rmrf(dir);
      }
    }
  }
  if (opts.reuseRow) {
    const existing = await prisma.asset.findFirst({ where: { userId: opts.userId, storageKey: opts.key } });
    if (existing) return existing;
  }
  return prisma.asset.create({
    data: {
      userId: opts.userId,
      projectId: opts.projectId,
      kind: opts.kind,
      source: opts.source,
      name: opts.name,
      mime: opts.mime,
      storageKey: opts.key,
      sizeBytes: BigInt(meta.sizeBytes ?? 0),
      durationMs: meta.durationMs,
      width: meta.width,
      height: meta.height,
      status: "READY",
      attribution: opts.attribution,
      tags: opts.tags ?? [],
    },
  });
}

function refWithSource(row: Asset, source: AssetRef["source"]): AssetRef {
  return { ...assetRefFromRow(row), source };
}

/* ------------------------------ ElevenLabs ---------------------------- */

async function elevenPost(pathname: string, body: unknown, accept = "audio/mpeg"): Promise<Buffer> {
  const res = await fetch(`${ELEVEN}${pathname}`, {
    method: "POST",
    headers: { "xi-api-key": env.elevenLabsKey, "Content-Type": "application/json", Accept: accept },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status} on ${pathname}: ${text.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function moodInfo(mood: string) {
  return MUSIC_MOOD_INFO.find((m) => m.id === mood) ?? MUSIC_MOOD_INFO.find((m) => m.id === "lofi")!;
}

function musicBucketSec(durationMs: number) {
  return Math.min(300, Math.max(15, Math.ceil(durationMs / 15000) * 15));
}

/* -------------------------------- music ------------------------------- */

async function getMusic({ mood, durationMs, projectId }: { mood: string; durationMs: number; projectId: string }): Promise<AssetRef> {
  const userId = await projectOwner(projectId);
  const info = moodInfo(mood);
  const seconds = musicBucketSec(durationMs);
  const bpm = Math.round((info.bpm[0] + info.bpm[1]) / 2);

  if (env.elevenLabsKey) {
    try {
      const prompt = `${info.name} instrumental background music for a short social video: ${info.description}. Around ${bpm} bpm, no vocals, steady energy, loopable, clean mix that sits under speech.`;
      const bytes = await elevenPost(`/music?output_format=mp3_44100_128`, { prompt, music_length_ms: Math.min(300_000, Math.max(10_000, seconds * 1000)), model_id: "music_v1", force_instrumental: true });
      const row = await storeAsset({
        key: storageKeys().generated(projectId, `music-${slug(info.id)}-${Date.now().toString(36)}.mp3`),
        userId,
        projectId,
        kind: "AUDIO",
        source: "GENERATED",
        name: `${info.name} music (${seconds}s)`,
        mime: "audio/mpeg",
        tags: ["music", info.id],
        attribution: "Generated with ElevenLabs Music",
        make: (file) => fsp.writeFile(file, bytes),
      });
      return refWithSource(row, "generated");
    } catch (e) {
      log("media", "ElevenLabs music failed, using placeholder:", errorMessage(e));
    }
  }

  const row = await storeAsset({
    key: storageKeys().library(`music/${slug(info.id)}-${seconds}s.mp3`),
    userId,
    projectId: null,
    kind: "AUDIO",
    source: "LIBRARY",
    name: `${info.name} bed (${seconds}s)`,
    mime: "audio/mpeg",
    tags: ["music", info.id, "placeholder"],
    attribution: "Placeholder music (no music provider configured)",
    reuseRow: true,
    make: async (file) => {
      await synthAudio(file, { seconds, kind: "music", mood: info.id, bpm });
    },
  });
  return refWithSource(row, "library");
}

/* -------------------------------- sfx --------------------------------- */

async function getSfx({ sfxId, projectId }: { sfxId: string; projectId: string }): Promise<AssetRef> {
  const userId = await projectOwner(projectId);
  const info = SFX_LIBRARY.find((s) => s.id === sfxId) ?? { id: sfxId, name: sfxId, description: sfxId.replace(/^sfx-/, "").replace(/-/g, " "), durationMs: 600 };
  const seconds = Math.min(22, Math.max(0.5, info.durationMs / 1000));

  if (env.elevenLabsKey) {
    try {
      const row = await storeAsset({
        key: storageKeys().library(`sfx/el-${slug(info.id)}.mp3`),
        userId,
        projectId: null,
        kind: "AUDIO",
        source: "LIBRARY",
        name: info.name,
        mime: "audio/mpeg",
        tags: ["sfx", info.id],
        attribution: "Generated with ElevenLabs",
        reuseRow: true,
        make: async (file) => {
          const bytes = await elevenPost(`/sound-generation?output_format=mp3_44100_128`, { text: `${info.name}: ${info.description}`, duration_seconds: seconds, prompt_influence: 0.4 });
          await fsp.writeFile(file, bytes);
        },
      });
      return refWithSource(row, "library");
    } catch (e) {
      log("media", "ElevenLabs sfx failed, using placeholder:", errorMessage(e));
    }
  }

  const row = await storeAsset({
    key: storageKeys().library(`sfx/${slug(info.id)}.mp3`),
    userId,
    projectId: null,
    kind: "AUDIO",
    source: "LIBRARY",
    name: info.name,
    mime: "audio/mpeg",
    tags: ["sfx", info.id, "placeholder"],
    attribution: "Placeholder sound (no SFX provider configured)",
    reuseRow: true,
    make: async (file) => {
      await synthAudio(file, { seconds, kind: "sfx", sfxId: info.id });
    },
  });
  return refWithSource(row, "library");
}

/* ------------------------------- stock -------------------------------- */

interface StockHit {
  provider: "pexels" | "pixabay";
  id: string;
  kind: "video" | "image";
  downloadUrl: string;
  width?: number;
  height?: number;
  durationMs?: number;
  name: string;
  attribution: string;
}

async function downloadToFile(url: string, file: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${url}`);
  await fsp.writeFile(file, Buffer.from(await res.arrayBuffer()));
  return res.headers.get("content-type") ?? "";
}

function orientationOf(w?: number, h?: number): Orientation | undefined {
  if (!w || !h) return undefined;
  const r = w / h;
  return r > 1.1 ? "landscape" : r < 0.9 ? "portrait" : "square";
}

async function searchPexels(query: string, kind: "video" | "image", orientation: Orientation, limit: number): Promise<StockHit[]> {
  const headers = { Authorization: env.pexelsKey };
  const perPage = String(Math.min(80, Math.max(1, limit)));
  if (kind === "video") {
    const url = `https://api.pexels.com/videos/search?${new URLSearchParams({ query, orientation, per_page: perPage, size: "medium" })}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const json = (await res.json()) as { videos?: Array<{ id: number; duration: number; width: number; height: number; url: string; user?: { name: string }; video_files: Array<{ link: string; width?: number; height?: number; quality?: string; file_type?: string }> }> };
    return (json.videos ?? []).flatMap((v) => {
      const files = v.video_files.filter((f) => (f.file_type ?? "video/mp4") === "video/mp4" && f.width && f.height).sort((a, b) => Math.max(b.width!, b.height!) - Math.max(a.width!, a.height!));
      const pick = files.find((f) => Math.max(f.width!, f.height!) <= 1920) ?? files[files.length - 1];
      if (!pick) return [];
      return [{ provider: "pexels" as const, id: String(v.id), kind: "video" as const, downloadUrl: pick.link, width: pick.width, height: pick.height, durationMs: Math.round(v.duration * 1000), name: `Pexels video ${v.id}: ${query}`, attribution: `Video by ${v.user?.name ?? "Pexels creator"} on Pexels (${v.url})` }];
    });
  }
  const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query, orientation, per_page: perPage })}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const json = (await res.json()) as { photos?: Array<{ id: number; width: number; height: number; url: string; photographer?: string; alt?: string; src: { large2x?: string; large?: string; original: string } }> };
  return (json.photos ?? []).map((p) => ({
    provider: "pexels" as const,
    id: String(p.id),
    kind: "image" as const,
    downloadUrl: p.src.large2x ?? p.src.large ?? p.src.original,
    width: p.width,
    height: p.height,
    name: p.alt || `Pexels photo ${p.id}: ${query}`,
    attribution: `Photo by ${p.photographer ?? "Pexels creator"} on Pexels (${p.url})`,
  }));
}

async function searchPixabay(query: string, kind: "video" | "image", orientation: Orientation, limit: number): Promise<StockHit[]> {
  const perPage = String(Math.min(200, Math.max(3, limit * 3)));
  if (kind === "video") {
    const url = `https://pixabay.com/api/videos/?${new URLSearchParams({ key: env.pixabayKey, q: query, per_page: perPage, safesearch: "true" })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pixabay ${res.status}`);
    const json = (await res.json()) as { hits?: Array<{ id: number; duration: number; pageURL: string; user?: string; videos: Record<string, { url: string; width: number; height: number }> }> };
    return (json.hits ?? [])
      .map((h) => {
        const file = h.videos.medium ?? h.videos.small ?? h.videos.large ?? Object.values(h.videos)[0];
        if (!file) return null;
        return { provider: "pixabay" as const, id: String(h.id), kind: "video" as const, downloadUrl: file.url, width: file.width, height: file.height, durationMs: Math.round(h.duration * 1000), name: `Pixabay video ${h.id}: ${query}`, attribution: `Video by ${h.user ?? "Pixabay creator"} on Pixabay (${h.pageURL})` };
      })
      .filter((h): h is NonNullable<typeof h> => !!h)
      .filter((h) => orientationOf(h.width, h.height) === orientation || orientation === "square")
      .slice(0, limit);
  }
  const url = `https://pixabay.com/api/?${new URLSearchParams({ key: env.pixabayKey, q: query, per_page: perPage, image_type: "photo", orientation: orientation === "portrait" ? "vertical" : "horizontal", safesearch: "true" })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const json = (await res.json()) as { hits?: Array<{ id: number; pageURL: string; user?: string; tags?: string; largeImageURL: string; imageWidth?: number; imageHeight?: number }> };
  return (json.hits ?? []).slice(0, limit).map((h) => ({
    provider: "pixabay" as const,
    id: String(h.id),
    kind: "image" as const,
    downloadUrl: h.largeImageURL,
    width: h.imageWidth,
    height: h.imageHeight,
    name: h.tags ? `${h.tags}` : `Pixabay photo ${h.id}: ${query}`,
    attribution: `Image by ${h.user ?? "Pixabay creator"} on Pixabay (${h.pageURL})`,
  }));
}

/** Download real stock hits into storage (Pixabay forbids hotlinking) and create STOCK Asset rows. */
async function storeStockHits(hits: StockHit[], projectId: string, userId: string, query: string): Promise<AssetRef[]> {
  const refs: AssetRef[] = [];
  for (const hit of hits) {
    try {
      const guessExt = hit.kind === "video" ? "mp4" : "jpg";
      const row = await storeAsset({
        key: storageKeys().generated(projectId, `stock-${hit.provider}-${hit.id}.${guessExt}`),
        userId,
        projectId,
        kind: hit.kind === "video" ? "VIDEO" : "IMAGE",
        source: "STOCK",
        name: hit.name,
        mime: mimeForExt(guessExt),
        attribution: hit.attribution,
        tags: ["stock", hit.provider, slug(query)],
        make: async (file) => {
          const type = await downloadToFile(hit.downloadUrl, file);
          const ext = extForMime(type, guessExt);
          if (ext !== guessExt) log("media", `stock ${hit.id} came back as ${type}; stored with .${guessExt} name`);
        },
      });
      refs.push({ ...refWithSource(row, "stock"), attribution: hit.attribution });
    } catch (e) {
      log("media", `stock download failed for ${hit.provider}:${hit.id}:`, errorMessage(e));
    }
  }
  return refs;
}

function drawtextEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/%/g, "\\%").replace(/,/g, "\\,");
}

/** MOCK stock: two ffmpeg-drawn placeholders labelled with the query, cached in the library. */
async function mockStock(query: string, kind: "video" | "image", orientation: Orientation, projectId: string, userId: string, limit: number): Promise<AssetRef[]> {
  const { w, h } = MOCK_SIZES[orientation];
  const label = drawtextEscape(query.replace(/[^\w\s\-]/g, "").trim().slice(0, 40) || "b-roll");
  const text = `drawtext=text='${label}':fontsize=${Math.round(w / 16)}:fontcolor=white:borderw=3:bordercolor=black@0.6:x=(w-text_w)/2:y=(h-text_h)/2`;
  const variants =
    kind === "video"
      ? [`testsrc2=size=${w}x${h}:rate=30:duration=6,${text}`, `gradients=size=${w}x${h}:duration=6:rate=30:speed=0.03,${text}`]
      : [`color=c=0x1e293b:size=${w}x${h}:rate=1,${text}`, `color=c=0x5b21b6:size=${w}x${h}:rate=1,${text}`];
  const refs: AssetRef[] = [];
  for (let i = 0; i < Math.min(limit, variants.length); i++) {
    const filter = variants[i]!;
    const ext = kind === "video" ? "mp4" : "jpg";
    const row = await storeAsset({
      key: storageKeys().library(`stock/mock-${slug(query)}-${orientation}-${i}.${ext}`),
      userId,
      projectId,
      kind: kind === "video" ? "VIDEO" : "IMAGE",
      source: "STOCK",
      name: `Stock ${kind}: ${query} (${i + 1})`,
      mime: mimeForExt(ext),
      attribution: "Placeholder stock media (no stock API key configured)",
      tags: ["stock", "placeholder", slug(query)],
      make: async (file) => {
        if (kind === "video") {
          try {
            await ffmpeg(["-f", "lavfi", "-i", filter, "-t", "6", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
          } catch {
            await ffmpeg(["-f", "lavfi", "-i", `color=c=0x334155:size=${w}x${h}:rate=30:duration=6`, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", file]);
          }
        } else {
          await ffmpeg(["-f", "lavfi", "-i", filter, "-frames:v", "1", "-q:v", "3", file]);
        }
      },
    });
    refs.push(refWithSource(row, "stock"));
  }
  return refs;
}

async function searchStock({ query, kind, orientation, projectId, limit }: { query: string; kind: "video" | "image"; orientation: Orientation; projectId: string; limit?: number }): Promise<AssetRef[]> {
  const userId = await projectOwner(projectId);
  const n = Math.max(1, Math.min(10, limit ?? 3));
  if (env.pexelsKey) {
    try {
      const hits = await searchPexels(query, kind, orientation, n);
      const refs = await storeStockHits(hits.slice(0, n), projectId, userId, query);
      if (refs.length) return refs;
    } catch (e) {
      log("media", "Pexels search failed:", errorMessage(e));
    }
  }
  if (env.pixabayKey) {
    try {
      const hits = await searchPixabay(query, kind, orientation, n);
      const refs = await storeStockHits(hits.slice(0, n), projectId, userId, query);
      if (refs.length) return refs;
    } catch (e) {
      log("media", "Pixabay search failed:", errorMessage(e));
    }
  }
  if (env.pexelsKey || env.pixabayKey) return [];
  return mockStock(query, kind, orientation, projectId, userId, Math.min(n, 2));
}

/* -------------------------------- voice ------------------------------- */

async function generateVoiceImpl({ text, voice, projectId }: { text: string; voice?: string; projectId: string }): Promise<AssetRef> {
  const userId = await projectOwner(projectId);
  const voiceId = voice || DEFAULT_VOICE;
  const bytes = await elevenPost(`/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, { text, model_id: "eleven_multilingual_v2" });
  const row = await storeAsset({
    key: storageKeys().generated(projectId, `voice-${Date.now().toString(36)}.mp3`),
    userId,
    projectId,
    kind: "AUDIO",
    source: "GENERATED",
    name: `Voice-over: ${text.slice(0, 40)}${text.length > 40 ? "…" : ""}`,
    mime: "audio/mpeg",
    tags: ["voice"],
    attribution: "Generated with ElevenLabs",
    make: (file) => fsp.writeFile(file, bytes),
  });
  return refWithSource(row, "generated");
}

/* ------------------------------- export ------------------------------- */

export const media: MediaProvider = {
  getMusic,
  getSfx,
  searchStock,
  /** Only available with an ElevenLabs key: the agent checks `media.generateVoice` before offering voice-over. */
  get generateVoice() {
    return env.elevenLabsKey ? generateVoiceImpl : undefined;
  },
  generateImage: undefined,
};
