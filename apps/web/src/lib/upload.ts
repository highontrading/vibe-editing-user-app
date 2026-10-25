"use client";
/**
 * Browser uploader + global upload store.
 *
 *   import { uploadFiles, useUploads } from "@/lib/upload";
 *   const assetIds = await uploadFiles(files, { projectId });   // resolves when all files are UPLOADED
 *
 * Flow per file:
 *   POST /api/assets/create  -> { assetId, upload: single | multipart }
 *   single:    PUT bytes to upload.url (local storage route or S3 signed URL)
 *   multipart: POST /api/assets/[id]/part per part -> signed URL -> PUT part -> POST /api/assets/[id]/complete
 *   POST /api/assets/[id]/uploaded -> marks UPLOADED and enqueues ingest
 *
 * Three files upload in parallel; each part retries up to 4 times with backoff.
 * The zustand store survives client-side navigation so the tray keeps showing progress.
 */
import { create } from "zustand";
import { api } from "./utils";

export type UploadStatus = "queued" | "uploading" | "finishing" | "processing" | "done" | "error" | "cancelled";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  mime: string;
  progress: number; // 0..100 (bytes sent)
  status: UploadStatus;
  assetId?: string;
  projectId?: string;
  error?: string;
  startedAt: number;
  speedBps?: number;
}

interface UploadState {
  items: UploadItem[];
  collapsed: boolean;
  add: (item: UploadItem) => void;
  update: (id: string, patch: Partial<UploadItem>) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
  setCollapsed: (v: boolean) => void;
}

export const useUploads = create<UploadState>((set) => ({
  items: [],
  collapsed: false,
  add: (item) => set((s) => ({ items: [...s.items, item], collapsed: false })),
  update: (id, patch) => set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
  clearFinished: () => set((s) => ({ items: s.items.filter((it) => !["done", "error", "cancelled"].includes(it.status)) })),
  setCollapsed: (v) => set({ collapsed: v }),
}));

type CreateResponse = {
  assetId: string;
  upload: { mode: "single"; url: string; headers: Record<string, string> } | { mode: "multipart"; uploadId: string; partSize: number; key: string };
};

const CONCURRENCY = 3;
const MAX_RETRIES = 4;
const controllers = new Map<string, { xhr?: XMLHttpRequest; cancelled: boolean }>();

export function cancelUpload(id: string) {
  const c = controllers.get(id);
  if (c) {
    c.cancelled = true;
    c.xhr?.abort();
  }
  useUploads.getState().update(id, { status: "cancelled", error: "Cancelled" });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function putWithProgress(id: string, url: string, body: Blob, headers: Record<string, string>, onProgress: (sent: number) => void): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const ctl = controllers.get(id);
    if (ctl) ctl.xhr = xhr;
    xhr.open("PUT", url, true);
    for (const [k, v] of Object.entries(headers)) {
      try {
        xhr.setRequestHeader(k, v);
      } catch {
        /* some headers are restricted */
      }
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ etag: (xhr.getResponseHeader("ETag") || "").replace(/"/g, "") });
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Cancelled"));
    xhr.send(body);
  });
}

async function withRetry<T>(id: string, fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      const ctl = controllers.get(id);
      if (ctl?.cancelled) throw e;
      attempt++;
      if (attempt > MAX_RETRIES) throw e;
      await sleep(500 * 2 ** attempt);
    }
  }
}

async function uploadOne(item: UploadItem, file: File, opts: { projectId?: string; folder?: string }): Promise<string> {
  const { update } = useUploads.getState();
  controllers.set(item.id, { cancelled: false });
  update(item.id, { status: "uploading", progress: 0 });
  const created = await api<CreateResponse>("/api/assets/create", {
    method: "POST",
    json: { name: file.name, mime: file.type || "application/octet-stream", size: file.size, projectId: opts.projectId, folder: opts.folder },
  });
  update(item.id, { assetId: created.assetId });
  const started = Date.now();
  const report = (sent: number) => {
    const pct = file.size ? Math.min(100, Math.round((sent / file.size) * 100)) : 100;
    const elapsed = (Date.now() - started) / 1000;
    update(item.id, { progress: pct, speedBps: elapsed > 0.5 ? sent / elapsed : undefined });
  };

  if (created.upload.mode === "single") {
    const { url, headers } = created.upload;
    await withRetry(item.id, () => putWithProgress(item.id, url, file, headers, report));
  } else {
    const { uploadId, partSize } = created.upload;
    const total = Math.ceil(file.size / partSize);
    const parts: { partNumber: number; etag: string }[] = [];
    const sentPerPart = new Array<number>(total).fill(0);
    const reportParts = () => report(sentPerPart.reduce((a, b) => a + b, 0));
    for (let i = 0; i < total; i++) {
      const partNumber = i + 1;
      const blob = file.slice(i * partSize, Math.min(file.size, (i + 1) * partSize));
      const res = await withRetry(item.id, async () => {
        const { url } = await api<{ url: string }>(`/api/assets/${created.assetId}/part`, { method: "POST", json: { uploadId, partNumber } });
        return putWithProgress(item.id, url, blob, {}, (sent) => {
          sentPerPart[i] = sent;
          reportParts();
        });
      });
      sentPerPart[i] = blob.size;
      reportParts();
      parts.push({ partNumber, etag: res.etag });
    }
    update(item.id, { status: "finishing" });
    await api(`/api/assets/${created.assetId}/complete`, { method: "POST", json: { uploadId, parts } });
  }
  update(item.id, { status: "finishing", progress: 100 });
  await api(`/api/assets/${created.assetId}/uploaded`, { method: "POST", json: {} });
  update(item.id, { status: "processing" });
  controllers.delete(item.id);
  void watchProcessing(item.id, created.assetId);
  return created.assetId;
}

/** Poll the asset until ingest finishes (or give up after a while) so the tray can show "Ready". */
async function watchProcessing(id: string, assetId: string) {
  const { update } = useUploads.getState();
  for (let i = 0; i < 60; i++) {
    await sleep(i < 10 ? 2000 : 5000);
    try {
      const a = await api<{ status: string; error?: string | null }>(`/api/assets/${assetId}`);
      if (a.status === "READY") return update(id, { status: "done" });
      if (a.status === "FAILED") return update(id, { status: "error", error: a.error || "Processing failed" });
    } catch {
      /* keep polling */
    }
  }
  update(id, { status: "done" });
}

let queue: Promise<void> = Promise.resolve();
let active = 0;
const waiters: (() => void)[] = [];
async function acquire() {
  if (active < CONCURRENCY) {
    active++;
    return;
  }
  await new Promise<void>((r) => waiters.push(r));
  active++;
}
function release() {
  active--;
  waiters.shift()?.();
}

export interface UploadOptions {
  projectId?: string;
  folder?: string;
  onEach?: (assetId: string, file: File) => void;
}

/** Upload files in parallel (3 at a time). Resolves with the asset ids of successful uploads. */
export async function uploadFiles(files: File[] | FileList, opts: UploadOptions = {}): Promise<string[]> {
  const list = Array.from(files).filter((f) => f.size > 0);
  const { add } = useUploads.getState();
  const results = await Promise.all(
    list.map(async (file) => {
      const item: UploadItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, size: file.size, mime: file.type, progress: 0, status: "queued", projectId: opts.projectId, startedAt: Date.now() };
      add(item);
      await acquire();
      try {
        const assetId = await uploadOne(item, file, opts);
        opts.onEach?.(assetId, file);
        return assetId;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        if (useUploads.getState().items.find((i) => i.id === item.id)?.status !== "cancelled") useUploads.getState().update(item.id, { status: "error", error: msg });
        return null;
      } finally {
        release();
      }
    }),
  );
  queue = queue.then(() => undefined);
  return results.filter((x): x is string => !!x);
}

export const ACCEPTED_MEDIA = "video/*,audio/*,image/*,.mp4,.mov,.m4v,.webm,.mkv,.mp3,.wav,.m4a,.aac,.png,.jpg,.jpeg,.webp,.gif";

export function isMediaFile(file: File) {
  if (/^(video|audio|image)\//.test(file.type)) return true;
  return /\.(mp4|mov|m4v|webm|mkv|avi|mp3|wav|m4a|aac|flac|png|jpe?g|webp|gif|heic)$/i.test(file.name);
}

/** Collect files from a drop event, including files inside dropped folders. */
export async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const out: File[] = [];
  const items = Array.from(dt.items ?? []);
  const entries = items.map((it) => (typeof it.webkitGetAsEntry === "function" ? it.webkitGetAsEntry() : null));
  if (entries.some((e) => e)) {
    const walk = async (entry: FileSystemEntry | null): Promise<void> => {
      if (!entry) return;
      if (entry.isFile) {
        const f = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
        if (isMediaFile(f)) out.push(f);
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const children = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        for (const c of children) await walk(c);
      }
    };
    for (const e of entries) await walk(e);
    if (out.length) return out;
  }
  return Array.from(dt.files ?? []).filter(isMediaFile);
}
