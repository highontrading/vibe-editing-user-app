/**
 * Server-only: map storage keys (or already-absolute URLs) to fetchable URLs
 * and resolve every asset URL in an EditScript for the Remotion Player.
 */
import "server-only";
import { mediaUrl } from "@/lib/media-url";
import type { EditScript } from "@vibe/edl";

const ABSOLUTE = /^(https?:)?\/\/|^data:|^blob:/i;

export function isAbsoluteUrl(value: string): boolean {
  return ABSOLUTE.test(value);
}

/** A storage key or absolute URL -> URL a browser can fetch. */
export async function resolveMediaUrl(keyOrUrl: string | null | undefined, opts?: { download?: string }): Promise<string | null> {
  if (!keyOrUrl) return null;
  if (isAbsoluteUrl(keyOrUrl)) return keyOrUrl;
  return mediaUrl(keyOrUrl, opts);
}

/** Returns a copy of the script whose assets[*].url are all fetchable. */
export async function resolveScriptUrls(script: EditScript): Promise<EditScript> {
  const assets: EditScript["assets"] = {};
  const entries = Object.entries(script.assets);
  const urls = await Promise.all(entries.map(([, a]) => resolveMediaUrl(a.url)));
  entries.forEach(([id, a], i) => {
    assets[id] = { ...a, url: urls[i] ?? a.url };
  });
  return { ...script, assets };
}
