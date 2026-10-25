/**
 * Turns storage keys into URLs a browser / Remotion can fetch.
 *  - http(s), data:, blob: URLs are left alone
 *  - local driver: `${APP_URL}/api/storage/<key>` (or a custom base, e.g. the
 *    worker's private asset server during a render)
 *  - S3 driver: signed URL (or the public CDN URL when configured)
 */
import { getStorage } from "@vibe/core";
import type { EditScript } from "@vibe/edl";

const ABSOLUTE = /^(https?:)?\/\/|^data:|^blob:|^file:/i;
const KEY_PREFIXES = ["users/", "derived/", "renders/", "generated/", "library/", "thumbs/"];

export function isAbsoluteUrl(value: string): boolean {
  return ABSOLUTE.test(value);
}

export function looksLikeStorageKey(value: string): boolean {
  return !isAbsoluteUrl(value) && KEY_PREFIXES.some((p) => value.startsWith(p));
}

export function encodeKey(key: string): string {
  return key.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
}

export interface ResolveOptions {
  /** Override base URL for storage keys (e.g. http://127.0.0.1:PORT during a worker render). */
  baseUrl?: string;
  expiresInSec?: number;
}

/** Storage key or URL -> fetchable absolute URL. */
export async function getAssetUrl(keyOrUrl: string, opts: ResolveOptions = {}): Promise<string> {
  if (!keyOrUrl) return keyOrUrl;
  if (isAbsoluteUrl(keyOrUrl)) return keyOrUrl;
  if (opts.baseUrl) return `${opts.baseUrl.replace(/\/$/, "")}/${encodeKey(keyOrUrl)}`;
  return getStorage().getUrl(keyOrUrl, { expiresInSec: opts.expiresInSec ?? 6 * 3600 });
}

const GRAPHIC_URL_PROPS = ["src", "url", "image", "logo", "imageUrl", "logoUrl", "assetUrl"];

/** Copy of the script with every assets[*].url (and obvious graphic image props) resolved. */
export async function resolveScriptAssets(script: EditScript, opts: ResolveOptions = {}): Promise<EditScript> {
  const assets: EditScript["assets"] = {};
  const entries = Object.entries(script.assets);
  const urls = await Promise.all(entries.map(([, a]) => getAssetUrl(a.url, opts)));
  entries.forEach(([id, a], i) => {
    assets[id] = { ...a, url: urls[i] ?? a.url };
  });
  const tracks = await Promise.all(
    script.tracks.map(async (t) => {
      if (t.kind !== "graphics") return t;
      const items = await Promise.all(
        t.items.map(async (item) => {
          const props = { ...item.props };
          for (const p of GRAPHIC_URL_PROPS) {
            const v = props[p];
            if (typeof v === "string" && looksLikeStorageKey(v)) props[p] = await getAssetUrl(v, opts);
          }
          return { ...item, props };
        }),
      );
      return { ...t, items };
    }),
  );
  return { ...script, assets, tracks };
}
