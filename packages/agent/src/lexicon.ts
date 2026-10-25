/** Keyword lexicon shared by the heuristic planner and the rule-based edit interpreter. */
import { CAPTION_STYLE_IDS, CAPTION_STYLES, COLOR_PRESETS, MUSIC_MOODS, PLATFORMS, type Aspect, type CaptionStyleId, type ColorPreset, type MusicMood, type Platform } from "@vibe/edl";

export const STYLE_ALIASES: Record<string, CaptionStyleId> = {
  "bold pop": "bold-pop", boldpop: "bold-pop", bold: "bold-pop", pop: "bold-pop",
  "clean minimal": "clean-minimal", minimal: "clean-minimal", clean: "clean-minimal", premium: "clean-minimal", calm: "clean-minimal",
  hormozi: "hormozi", alex: "hormozi",
  karaoke: "karaoke", lyrics: "karaoke",
  typewriter: "typewriter", monospace: "typewriter", retro: "typewriter",
  outline: "outline", outlined: "outline",
  glow: "glow", neon: "glow",
  boxed: "boxed", box: "boxed", story: "boxed",
  "lower third": "lower-third", broadcast: "lower-third",
  "two line": "two-line", "two-line": "two-line", twoline: "two-line", podcast: "two-line",
  "emoji pop": "emoji-pop", emoji: "emoji-pop",
  handwritten: "handwritten", handwriting: "handwritten", diary: "handwritten",
};
for (const s of CAPTION_STYLES) {
  STYLE_ALIASES[s.id] = s.id;
  STYLE_ALIASES[s.name.toLowerCase()] = s.id;
}

export const MOOD_ALIASES: Record<string, MusicMood> = {
  upbeat: "upbeat", happy: "upbeat", bright: "upbeat", positive: "upbeat", pop: "upbeat",
  lofi: "lofi", "lo-fi": "lofi", "lo fi": "lofi", "hip hop": "lofi", chillhop: "lofi",
  cinematic: "cinematic", epic: "cinematic", orchestral: "cinematic", dramatic: "cinematic", strings: "cinematic",
  chill: "chill", relaxed: "chill", ambient: "chill", soft: "chill", mellow: "chill",
  energetic: "energetic", hype: "energetic", edm: "energetic", trap: "energetic", intense: "energetic", fast: "energetic", "high energy": "energetic",
  emotional: "emotional", piano: "emotional", sad: "emotional", heartfelt: "emotional", touching: "emotional",
  corporate: "corporate", business: "corporate", professional: "corporate", clean: "corporate",
  funky: "funky", funk: "funky", groovy: "funky", disco: "funky",
  dark: "dark", tense: "dark", mysterious: "dark", moody: "dark", suspense: "dark",
  acoustic: "acoustic", guitar: "acoustic", organic: "acoustic", folk: "acoustic", warm: "acoustic",
};

export const COLOR_ALIASES: Record<string, ColorPreset> = {
  "warm film": "warm-film", "warm-film": "warm-film", film: "warm-film", filmic: "warm-film", warm: "warm-film", vintage: "warm-film", analog: "warm-film", kodak: "warm-film",
  clean: "clean", natural: "clean", neutral: "clean", bright: "clean", crisp: "clean",
  moody: "moody", dark: "moody", desaturated: "moody", cool: "moody", gloomy: "moody",
  vibrant: "vibrant", punchy: "vibrant", saturated: "vibrant", colorful: "vibrant", colourful: "vibrant", vivid: "vibrant",
  bw: "bw", "b&w": "bw", "black and white": "bw", "black & white": "bw", monochrome: "bw", grayscale: "bw", greyscale: "bw",
  "teal orange": "teal-orange", "teal-orange": "teal-orange", "teal and orange": "teal-orange", cinematic: "teal-orange", hollywood: "teal-orange", blockbuster: "teal-orange",
  none: "none", "no grade": "none", "no color": "none", "no colour": "none", ungraded: "none",
};

export const COLOR_NAMES: Record<string, string> = {
  white: "#FFFFFF", black: "#111111", yellow: "#FFD400", gold: "#FFC107", red: "#FF3B30", green: "#3DFF6E", blue: "#3B82F6", pink: "#FF4D8D", orange: "#FF8A00", purple: "#A855F7", cyan: "#7CF0FF", teal: "#14B8A6", lime: "#A3E635", magenta: "#E91E63", grey: "#9CA3AF", gray: "#9CA3AF",
};

/** Find the longest alias present in the text; longer aliases win so "bold pop" beats "pop". */
export function findAlias<T extends string>(text: string, aliases: Record<string, T>, allowed?: readonly T[]): T | undefined {
  const lower = text.toLowerCase();
  let best: { len: number; value: T } | undefined;
  for (const [alias, value] of Object.entries(aliases)) {
    if (allowed && !allowed.includes(value)) continue;
    const re = new RegExp(`(^|[^\\p{L}])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
    if (re.test(lower) && (!best || alias.length > best.len)) best = { len: alias.length, value };
  }
  return best?.value;
}

export function isCaptionStyle(v: unknown): v is CaptionStyleId {
  return typeof v === "string" && (CAPTION_STYLE_IDS as readonly string[]).includes(v);
}
export function isMood(v: unknown): v is MusicMood {
  return typeof v === "string" && (MUSIC_MOODS as readonly string[]).includes(v);
}
export function isColorPreset(v: unknown): v is ColorPreset {
  return typeof v === "string" && (COLOR_PRESETS as readonly string[]).includes(v);
}
export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}

export function parsePlatform(text: string): Platform | undefined {
  const l = text.toLowerCase();
  if (/tik ?tok/.test(l)) return "tiktok";
  if (/reels?|instagram|insta\b|ig\b/.test(l)) return "reels";
  if (/shorts?\b/.test(l)) return "shorts";
  if (/youtube|yt\b/.test(l)) return "youtube";
  if (/linkedin/.test(l)) return "linkedin";
  if (/twitter|\bx\b post|on x\b/.test(l)) return "x";
  return undefined;
}

export function parseAspect(text: string): Aspect | undefined {
  const l = text.toLowerCase();
  if (/9[:x]16|vertical|portrait/.test(l)) return "9:16";
  if (/16[:x]9|landscape|horizontal|widescreen/.test(l)) return "16:9";
  if (/1[:x]1|square/.test(l)) return "1:1";
  if (/4[:x]5/.test(l)) return "4:5";
  return undefined;
}

/** "45 seconds", "45s", "1 minute", "1:30", "a minute and a half" → ms */
export function parseDurationMs(text: string): number | undefined {
  const l = text.toLowerCase();
  let m = l.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(s\b|sec|secs|seconds?)/);
  if (m) return Math.round(((Number(m[1]) + Number(m[2])) / 2) * 1000);
  m = l.match(/(\d+)\s*:\s*(\d{2})\b/);
  if (m && Number(m[1]) < 60) return (Number(m[1]) * 60 + Number(m[2])) * 1000;
  m = l.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(min|mins|minutes?)/);
  if (m) return Math.round(((Number(m[1]) + Number(m[2])) / 2) * 60_000);
  m = l.match(/(\d+(?:\.\d+)?)\s*(?:min|mins|minutes?)\b/);
  if (m) return Math.round(Number(m[1]) * 60_000);
  if (/\b(a|one) minute and a half\b/.test(l)) return 90_000;
  if (/\bhalf a minute\b/.test(l)) return 30_000;
  if (/\b(a|one) minute\b/.test(l)) return 60_000;
  m = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec\b|secs\b|seconds?\b)/);
  if (m) return Math.round(Number(m[1]) * 1000);
  return undefined;
}

/** A single timestamp like "0:42", "42s", "12.5", "1m20s" → ms */
export function parseTimestamp(text: string): number | undefined {
  const t = text.trim().toLowerCase();
  let m = t.match(/^(\d+):(\d{1,2})(?:\.(\d+))?$/);
  if (m) return Number(m[1]) * 60_000 + Number(m[2]) * 1000 + (m[3] ? Math.round(Number(`0.${m[3]}`) * 1000) : 0);
  m = t.match(/^(\d+)\s*m(?:in)?\s*(\d+)?\s*s?(?:ec)?$/);
  if (m) return Number(m[1]) * 60_000 + Number(m[2] ?? 0) * 1000;
  m = t.match(/^(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?$/);
  if (m) return Math.round(Number(m[1]) * 1000);
  return undefined;
}

/** Quoted text in a sentence: "..." '...' “...” */
export function quoted(text: string): string | undefined {
  const m = text.match(/["“”']([^"“”']{2,80})["“”']/);
  return m?.[1]?.trim();
}
