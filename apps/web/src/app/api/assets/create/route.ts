/**
 * POST /api/assets/create { name, mime, size, projectId?, folder? }
 * -> { assetId, upload: { mode: "single", url, headers } | { mode: "multipart", uploadId, partSize, key } }
 */
import { z } from "zod";
import { prisma } from "@vibe/db";
import { getStorage, storageKeys } from "@vibe/core";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { storageLimitBytes } from "@/lib/plan";

export const runtime = "nodejs";

const Body = z.object({ name: z.string().min(1).max(255), mime: z.string().max(120), size: z.number().int().nonnegative(), projectId: z.string().optional(), folder: z.string().max(80).optional() });

const PART_SIZE = 16 * 1024 * 1024;
const MULTIPART_THRESHOLD = 32 * 1024 * 1024;

function kindFor(mime: string, name: string): "VIDEO" | "AUDIO" | "IMAGE" {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime.startsWith("image/")) return "IMAGE";
  if (/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(name)) return "AUDIO";
  if (/\.(png|jpe?g|webp|gif|heic)$/i.test(name)) return "IMAGE";
  return "VIDEO";
}

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await parseBody(req, Body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } });
  const used = await prisma.asset.aggregate({ where: { userId }, _sum: { sizeBytes: true } });
  if (Number(used._sum.sizeBytes ?? 0) + body.size > storageLimitBytes(user.plan)) throw new ApiError(402, "Storage limit reached for your plan. Delete some assets or upgrade.", { code: "STORAGE_LIMIT" });
  if (body.projectId) {
    const p = await prisma.project.findUnique({ where: { id: body.projectId }, select: { userId: true } });
    if (!p || p.userId !== userId) throw new ApiError(404, "Project not found");
  }
  const storage = getStorage();
  const mime = body.mime || "application/octet-stream";
  const asset = await prisma.asset.create({ data: { userId, projectId: body.projectId ?? null, kind: kindFor(mime, body.name), name: body.name, mime, sizeBytes: BigInt(body.size), storageKey: "", status: "UPLOADING", folder: body.folder ?? null } });
  const key = storageKeys().upload(userId, asset.id, body.name);
  await prisma.asset.update({ where: { id: asset.id }, data: { storageKey: key } });

  if (storage.driver === "s3" && body.size > MULTIPART_THRESHOLD) {
    const mp = await storage.createMultipart(key, mime);
    if (mp) return json({ assetId: asset.id, upload: { mode: "multipart", uploadId: mp.uploadId, partSize: PART_SIZE, key } });
  }
  const up = await storage.getUploadUrl(key, mime);
  let url = up.url;
  if (storage.driver === "local") {
    // Same-origin relative URL so uploads work regardless of APP_URL.
    try {
      const u = new URL(url);
      url = u.pathname + u.search;
    } catch {}
  }
  return json({ assetId: asset.id, upload: { mode: "single", url, headers: up.headers } });
});
