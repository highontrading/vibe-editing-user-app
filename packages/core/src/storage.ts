/**
 * Object storage abstraction. S3-compatible (R2, Railway bucket, AWS, MinIO)
 * when S3_BUCKET is set; otherwise files live under DATA_DIR/storage and are
 * served/uploaded through the web app's /api/storage routes.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

export interface MultipartPart { partNumber: number; etag: string }

export interface Storage {
  readonly driver: "local" | "s3";
  /** Upload bytes/stream from the server. */
  put(key: string, body: Buffer | Readable | string, contentType?: string): Promise<void>;
  putFile(key: string, filePath: string, contentType?: string): Promise<void>;
  get(key: string): Promise<Readable>;
  getBuffer(key: string): Promise<Buffer>;
  downloadToFile(key: string, filePath: string): Promise<string>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** URL a browser can GET (signed for S3, app route for local). */
  getUrl(key: string, opts?: { expiresInSec?: number; download?: string }): Promise<string>;
  /** Single-request upload URL for the browser (PUT). */
  getUploadUrl(key: string, contentType: string, opts?: { expiresInSec?: number }): Promise<{ url: string; method: "PUT"; headers: Record<string, string> }>;
  /** Multipart (large file) upload for the browser. Local driver returns null => use single PUT. */
  createMultipart(key: string, contentType: string): Promise<{ uploadId: string } | null>;
  signPart(key: string, uploadId: string, partNumber: number): Promise<string>;
  completeMultipart(key: string, uploadId: string, parts: MultipartPart[]): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
  /** Local filesystem path for the object if the driver can provide one (local driver only). */
  localPath(key: string): string | null;
}

function safeKey(key: string): string {
  const norm = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (norm.split("/").some((p) => p === "..")) throw new Error("Invalid storage key");
  return norm;
}

class LocalStorage implements Storage {
  readonly driver = "local" as const;
  private root: string;
  constructor(root: string) {
    this.root = root;
    fs.mkdirSync(root, { recursive: true });
  }
  private p(key: string) {
    return path.join(this.root, safeKey(key));
  }
  localPath(key: string) {
    return this.p(key);
  }
  async put(key: string, body: Buffer | Readable | string) {
    const file = this.p(key);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    if (body instanceof Readable) await pipeline(body, fs.createWriteStream(file));
    else await fsp.writeFile(file, body);
  }
  async putFile(key: string, filePath: string) {
    const file = this.p(key);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.copyFile(filePath, file);
  }
  async get(key: string) {
    return fs.createReadStream(this.p(key));
  }
  async getBuffer(key: string) {
    return fsp.readFile(this.p(key));
  }
  async downloadToFile(key: string, filePath: string) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.copyFile(this.p(key), filePath);
    return filePath;
  }
  async exists(key: string) {
    try {
      await fsp.access(this.p(key));
      return true;
    } catch {
      return false;
    }
  }
  async delete(key: string) {
    await fsp.rm(this.p(key), { force: true });
  }
  async getUrl(key: string, opts?: { download?: string }) {
    const q = opts?.download ? `?download=${encodeURIComponent(opts.download)}` : "";
    return `${env.appUrl}/api/storage/${safeKey(key).split("/").map(encodeURIComponent).join("/")}${q}`;
  }
  async getUploadUrl(key: string, contentType: string) {
    return { url: `${env.appUrl}/api/storage/${safeKey(key).split("/").map(encodeURIComponent).join("/")}`, method: "PUT" as const, headers: { "Content-Type": contentType } };
  }
  async createMultipart() {
    return null;
  }
  async signPart(): Promise<string> {
    throw new Error("Multipart not supported by local storage");
  }
  async completeMultipart() {}
  async abortMultipart() {}
}

class S3Storage implements Storage {
  readonly driver = "s3" as const;
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;
  constructor(cfg: NonNullable<Env["s3"]>) {
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: !!cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
    this.bucket = cfg.bucket;
    this.publicUrl = cfg.publicUrl;
  }
  localPath() {
    return null;
  }
  async put(key: string, body: Buffer | Readable | string, contentType?: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: safeKey(key), Body: body, ContentType: contentType }));
  }
  async putFile(key: string, filePath: string, contentType?: string) {
    const stat = await fsp.stat(filePath);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: safeKey(key), Body: fs.createReadStream(filePath), ContentLength: stat.size, ContentType: contentType }));
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
    return res.Body as Readable;
  }
  async getBuffer(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async downloadToFile(key: string, filePath: string) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const stream = await this.get(key);
    await pipeline(stream, fs.createWriteStream(filePath));
    return filePath;
  }
  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
      return true;
    } catch {
      return false;
    }
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
  }
  async getUrl(key: string, opts?: { expiresInSec?: number; download?: string }) {
    if (this.publicUrl && !opts?.download) return `${this.publicUrl}/${safeKey(key)}`;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: safeKey(key), ResponseContentDisposition: opts?.download ? `attachment; filename="${opts.download}"` : undefined }),
      { expiresIn: opts?.expiresInSec ?? 3600 * 6 },
    );
  }
  async getUploadUrl(key: string, contentType: string, opts?: { expiresInSec?: number }) {
    const url = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: safeKey(key), ContentType: contentType }), { expiresIn: opts?.expiresInSec ?? 3600 });
    return { url, method: "PUT" as const, headers: { "Content-Type": contentType } };
  }
  async createMultipart(key: string, contentType: string) {
    const res = await this.client.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: safeKey(key), ContentType: contentType }));
    return { uploadId: res.UploadId! };
  }
  async signPart(key: string, uploadId: string, partNumber: number) {
    return getSignedUrl(this.client, new UploadPartCommand({ Bucket: this.bucket, Key: safeKey(key), UploadId: uploadId, PartNumber: partNumber }), { expiresIn: 3600 });
  }
  async completeMultipart(key: string, uploadId: string, parts: MultipartPart[]) {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: safeKey(key),
        UploadId: uploadId,
        MultipartUpload: { Parts: parts.sort((a, b) => a.partNumber - b.partNumber).map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
      }),
    );
  }
  async abortMultipart(key: string, uploadId: string) {
    await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: safeKey(key), UploadId: uploadId }));
  }
}

type Env = typeof env;
let instance: Storage | null = null;
export function getStorage(): Storage {
  if (instance) return instance;
  const s3 = env.s3;
  instance = s3 ? new S3Storage(s3) : new LocalStorage(path.join(env.dataDir, "storage"));
  return instance;
}

/** Scratch directory for temporary processing files. */
export async function scratchDir(name: string): Promise<string> {
  const dir = path.join(env.dataDir, "tmp", name);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

export function storageKeys() {
  return {
    upload: (userId: string, assetId: string, filename: string) => `users/${userId}/uploads/${assetId}/${filename.replace(/[^\w.\-]+/g, "_")}`,
    derived: (assetId: string, name: string) => `derived/${assetId}/${name}`,
    render: (projectId: string, exportId: string, name: string) => `renders/${projectId}/${exportId}/${name}`,
    generated: (projectId: string, name: string) => `generated/${projectId}/${name}`,
    library: (name: string) => `library/${name}`,
    thumbs: (projectId: string, name: string) => `thumbs/${projectId}/${name}`,
  };
}
