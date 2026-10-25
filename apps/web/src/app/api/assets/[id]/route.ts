import { z } from "zod";
import { prisma } from "@vibe/db";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { assetToDTO, latestJobsForAssets } from "@/lib/dto";
import { deleteAssetObjects, ownAsset } from "@/lib/assets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const a = await ownAsset(id, userId);
  const jobs = await latestJobsForAssets([a.id]);
  return json(await assetToDTO(a, jobs.get(a.id), true));
});

const Patch = z.object({ name: z.string().min(1).max(255).optional(), folder: z.string().max(80).nullable().optional(), tags: z.array(z.string().min(1).max(30)).max(20).optional(), projectId: z.string().nullable().optional() });

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await ownAsset(id, userId);
  const body = await parseBody(req, Patch);
  if (body.projectId) {
    const p = await prisma.project.findUnique({ where: { id: body.projectId }, select: { userId: true } });
    if (!p || p.userId !== userId) throw new ApiError(404, "Project not found");
  }
  const a = await prisma.asset.update({ where: { id }, data: { ...(body.name !== undefined ? { name: body.name.trim() } : {}), ...(body.folder !== undefined ? { folder: body.folder?.trim() || null } : {}), ...(body.tags !== undefined ? { tags: Array.from(new Set(body.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))) } : {}), ...(body.projectId !== undefined ? { projectId: body.projectId } : {}) } });
  return json(await assetToDTO(a));
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const a = await ownAsset(id, userId);
  await deleteAssetObjects(a);
  await prisma.asset.delete({ where: { id } });
  return json({ ok: true });
});
