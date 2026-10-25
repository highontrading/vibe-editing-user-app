import { z } from "zod";
import { prisma } from "@vibe/db";
import { getStorage } from "@vibe/core";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({ uploadId: z.string(), partNumber: z.number().int().min(1).max(10000) });

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const body = await parseBody(req, Body);
  const a = await prisma.asset.findUnique({ where: { id } });
  if (!a || a.userId !== userId) throw new ApiError(404, "Asset not found");
  const storage = getStorage();
  if (storage.driver !== "s3") throw new ApiError(400, "Multipart uploads need S3 storage");
  const url = await storage.signPart(a.storageKey, body.uploadId, body.partNumber);
  return json({ url });
});
