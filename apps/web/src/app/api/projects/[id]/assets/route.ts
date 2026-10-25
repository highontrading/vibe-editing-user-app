import { z } from "zod";
import { prisma } from "@vibe/db";
import { getStorage, storageKeys } from "@vibe/core";
import { route, json, parseBody, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getOwnedProject, toAssetView } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  name: z.string().trim().min(1).max(200),
  mime: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative().default(0),
});

function kindFromMime(mime: string): "VIDEO" | "AUDIO" | "IMAGE" {
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime.startsWith("image/")) return "IMAGE";
  return "VIDEO";
}

/**
 * POST /api/projects/[id]/assets {name, mime, sizeBytes} -> { asset, upload: {url, method, headers} }
 * Creates the Asset row (UPLOADING) and returns a single-PUT upload target.
 * Follow with POST /api/projects/[id]/assets/[assetId]/uploaded.
 */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await getOwnedProject(userId, id);
  const body = await parseBody(req, Body);
  const created = await prisma.asset.create({
    data: { userId, projectId: id, kind: kindFromMime(body.mime), name: body.name, mime: body.mime, sizeBytes: BigInt(body.sizeBytes), storageKey: "", status: "UPLOADING" },
  });
  const storageKey = storageKeys().upload(userId, created.id, body.name);
  const asset = await prisma.asset.update({ where: { id: created.id }, data: { storageKey } });
  const upload = await getStorage().getUploadUrl(storageKey, body.mime);
  return json(serialize({ asset: await toAssetView(asset), upload }));
});
