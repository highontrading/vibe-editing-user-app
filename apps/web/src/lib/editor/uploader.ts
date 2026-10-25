"use client";
/**
 * Minimal uploader for the editor: creates the Asset row through the project
 * API, PUTs the file to the returned upload URL (local driver -> /api/storage)
 * and marks it uploaded so `ingest` is enqueued.
 */
import { api } from "@/lib/utils";
import type { AssetView } from "./types";

export interface UploadProgress {
  assetId: string | null;
  name: string;
  loaded: number;
  total: number;
  status: "creating" | "uploading" | "finishing" | "done" | "error";
  error?: string;
}

export async function uploadToProject(projectId: string, file: File, onProgress: (p: UploadProgress) => void): Promise<AssetView> {
  const name = file.name || "upload";
  const mime = file.type || guessMime(name);
  onProgress({ assetId: null, name, loaded: 0, total: file.size, status: "creating" });
  const created = await api<{ asset: AssetView; upload: { url: string; method: "PUT"; headers: Record<string, string> } }>(`/api/projects/${projectId}/assets`, {
    method: "POST",
    json: { name, mime, sizeBytes: file.size },
  });
  const assetId = created.asset.id;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(created.upload.method, created.upload.url, true);
    for (const [k, v] of Object.entries(created.upload.headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress({ assetId, name, loaded: e.loaded, total: e.total || file.size, status: "uploading" });
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
  onProgress({ assetId, name, loaded: file.size, total: file.size, status: "finishing" });
  const done = await api<{ asset: AssetView }>(`/api/projects/${projectId}/assets/${assetId}/uploaded`, { method: "POST" });
  onProgress({ assetId, name, loaded: file.size, total: file.size, status: "done" });
  return done.asset;
}

function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
  return map[ext ?? ""] ?? "application/octet-stream";
}
