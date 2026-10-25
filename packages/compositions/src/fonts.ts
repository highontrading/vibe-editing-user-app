/**
 * Font loading with safe fallbacks.
 *
 * We take the font metadata (woff2 URLs) from `@remotion/google-fonts` but load
 * the faces ourselves so that a failed network request can never hang a render:
 * each load holds a `delayRender()` handle for at most FONT_TIMEOUT_MS and then
 * continues regardless, falling back to the system font stack.
 */
import { continueRender, delayRender } from "remotion";
import { getInfo as interInfo } from "@remotion/google-fonts/Inter";
import { getInfo as antonInfo } from "@remotion/google-fonts/Anton";
import { getInfo as archivoBlackInfo } from "@remotion/google-fonts/ArchivoBlack";
import { getInfo as montserratInfo } from "@remotion/google-fonts/Montserrat";
import { getInfo as jetBrainsMonoInfo } from "@remotion/google-fonts/JetBrainsMono";
import { getInfo as bebasNeueInfo } from "@remotion/google-fonts/BebasNeue";
import { getInfo as poppinsInfo } from "@remotion/google-fonts/Poppins";
import { getInfo as caveatInfo } from "@remotion/google-fonts/Caveat";

export const FONT_TIMEOUT_MS = 12_000;

export type FontKey = "inter" | "anton" | "archivo-black" | "montserrat" | "jetbrains-mono" | "bebas-neue" | "poppins" | "caveat";

interface FontMeta {
  fontFamily: string;
  unicodeRanges: Record<string, string>;
  fonts: Record<string, Record<string, Record<string, string>>>;
}

interface FontDef {
  info: () => FontMeta;
  weights: string[];
  /** CSS stack used while loading and when loading fails. */
  fallback: string;
}

const SANS_FALLBACK = `"Helvetica Neue", Helvetica, Arial, sans-serif`;
const IMPACT_FALLBACK = `Impact, "Arial Narrow Bold", "Helvetica Neue", Arial, sans-serif`;

export const FONTS: Record<FontKey, FontDef> = {
  inter: { info: interInfo, weights: ["300", "400", "500", "600", "700", "800", "900"], fallback: SANS_FALLBACK },
  anton: { info: antonInfo, weights: ["400"], fallback: IMPACT_FALLBACK },
  "archivo-black": { info: archivoBlackInfo, weights: ["400"], fallback: `"Arial Black", ${IMPACT_FALLBACK}` },
  montserrat: { info: montserratInfo, weights: ["600", "700", "800", "900"], fallback: SANS_FALLBACK },
  "jetbrains-mono": { info: jetBrainsMonoInfo, weights: ["500", "700"], fallback: `"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace` },
  "bebas-neue": { info: bebasNeueInfo, weights: ["400"], fallback: IMPACT_FALLBACK },
  poppins: { info: poppinsInfo, weights: ["600", "700", "800", "900"], fallback: SANS_FALLBACK },
  caveat: { info: caveatInfo, weights: ["500", "700"], fallback: `"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive` },
};

/** Lower-cased Google family name → key, so `settings.fontFamily: "Anton"` loads the real font. */
const BY_FAMILY: Record<string, FontKey> = Object.fromEntries(
  (Object.keys(FONTS) as FontKey[]).map((k) => [FONTS[k].info().fontFamily.toLowerCase(), k]),
);

export function fontKeyForFamily(family: string | undefined): FontKey | undefined {
  if (!family) return undefined;
  return BY_FAMILY[family.trim().replace(/^["']|["']$/g, "").toLowerCase()];
}

/** The CSS `font-family` value to use for a font key (real family first, then fallbacks). */
export function fontStack(key: FontKey): string {
  const def = FONTS[key];
  return `"${def.info().fontFamily}", ${def.fallback}`;
}

const SUBSETS = ["latin", "latin-ext"];
const loading = new Map<string, Promise<void>>();

function loadFace(meta: FontMeta, weight: string, subset: string): Promise<void> | null {
  const url = meta.fonts.normal?.[weight]?.[subset];
  if (!url || typeof FontFace === "undefined" || typeof document === "undefined") return null;
  const face = new FontFace(meta.fontFamily, `url(${url}) format('woff2')`, {
    weight,
    style: "normal",
    unicodeRange: meta.unicodeRanges[subset],
    display: "block",
  });
  return face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
    })
    .catch((err: unknown) => {
      if (typeof console !== "undefined") console.warn(`[compositions] font ${meta.fontFamily} ${weight} failed to load`, err);
    });
}

/**
 * Starts loading a font (idempotent). Holds a delayRender handle until the
 * font is ready or FONT_TIMEOUT_MS has elapsed, then always continues.
 */
export function ensureFont(key: FontKey, weights?: string[]): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const def = FONTS[key];
  const wanted = (weights ?? def.weights).filter((w) => def.weights.includes(w));
  const cacheKey = `${key}:${wanted.join(",")}`;
  const existing = loading.get(cacheKey);
  if (existing) return existing;

  const meta = def.info();
  const handle = delayRender(`Loading font ${meta.fontFamily}`, { timeoutInMilliseconds: FONT_TIMEOUT_MS + 5_000 });
  const faces: Promise<void>[] = [];
  for (const w of wanted) for (const s of SUBSETS) {
    const p = loadFace(meta, w, s);
    if (p) faces.push(p);
  }
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
  const promise = Promise.race([Promise.all(faces).then(() => undefined), timeout])
    .catch(() => undefined)
    .finally(() => continueRender(handle));
  loading.set(cacheKey, promise);
  return promise;
}

/** Start loading a font (idempotent) and return its CSS stack. Safe to call during render. */
export function loadFontStack(key: FontKey, weights?: string[]): string {
  // Kick off loading synchronously so the delayRender handle is registered
  // before Remotion takes the first screenshot. ensureFont is idempotent.
  ensureFont(key, weights);
  return fontStack(key);
}

/**
 * Resolve a user-provided family (CaptionSettings.fontFamily / graphic props)
 * to a CSS stack. Known Google families are loaded; unknown names are used as
 * given with the style's default font as fallback.
 */
export function fontStackFor(fallbackKey: FontKey, family?: string): string {
  const key = fontKeyForFamily(family);
  if (key) return loadFontStack(key);
  const base = loadFontStack(fallbackKey);
  if (family && family.trim()) return `"${family.trim().replace(/"/g, "")}", ${base}`;
  return base;
}
