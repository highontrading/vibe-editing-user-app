/**
 * Server-only helpers that turn storage keys into URLs a browser can load.
 * With the local driver this is the /api/storage route; with S3 it is a
 * signed URL (or the public CDN URL when S3_PUBLIC_URL is set).
 *
 * Usage (server components / route handlers only):
 *   const url = await mediaUrl(asset.thumbKey);
 *   const dto = await withMediaUrls(assetRow);
 */
import { getStorage } from "@vibe/core";

export async function mediaUrl(key: string | null | undefined, opts?: { download?: string; expiresInSec?: number }): Promise<string | null> {
  if (!key) return null;
  try {
    return await getStorage().getUrl(key, opts);
  } catch {
    return null;
  }
}

type Keys = { storageKey?: string | null; thumbKey?: string | null; proxyKey?: string | null; waveformKey?: string | null };

export async function withMediaUrls<T extends Keys>(row: T): Promise<T & { url: string | null; thumbUrl: string | null; proxyUrl: string | null; waveformUrl: string | null }> {
  const [url, thumbUrl, proxyUrl, waveformUrl] = await Promise.all([mediaUrl(row.storageKey), mediaUrl(row.thumbKey), mediaUrl(row.proxyKey), mediaUrl(row.waveformKey)]);
  return { ...row, url, thumbUrl, proxyUrl, waveformUrl };
}
