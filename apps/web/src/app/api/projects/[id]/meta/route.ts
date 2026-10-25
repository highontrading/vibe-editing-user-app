/**
 * Project metadata operations owned by the app screens (not the editor):
 *   PATCH  { title?, archived? }   rename / archive / unarchive
 *   DELETE                         delete project (+ its assets' storage objects, exports)
 *   POST   { title? }              duplicate (copies the project + current version)
 */
import { z } from "zod";
import { prisma } from "@vibe/db";
import { getStorage } from "@vibe/core";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { projectInclude, projectToDTO } from "@/lib/dto";
import { projectLimit } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function own(id: string, userId: string) {
  const p = await prisma.project.findUnique({ where: { id }, include: projectInclude });
  if (!p || p.userId !== userId) throw new ApiError(404, "Project not found");
  return p;
}

const Patch = z.object({ title: z.string().min(1).max(120).optional(), archived: z.boolean().optional() });

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await own(id, userId);
  const body = await parseBody(req, Patch);
  const updated = await prisma.project.update({ where: { id }, data: { ...(body.title !== undefined ? { title: body.title.trim() } : {}), ...(body.archived !== undefined ? { archived: body.archived } : {}) }, include: projectInclude });
  return json(await projectToDTO(updated));
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await own(id, userId);
  const storage = getStorage();
  const [assets, exports] = await Promise.all([prisma.asset.findMany({ where: { projectId: id, userId } }), prisma.export.findMany({ where: { projectId: id } })]);
  const keys: string[] = [];
  const sharedKeys = new Set((await prisma.asset.findMany({ where: { storageKey: { in: assets.map((a) => a.storageKey) }, projectId: { not: id } }, select: { storageKey: true } })).map((r) => r.storageKey));
  for (const a of assets) if (!sharedKeys.has(a.storageKey)) keys.push(...[a.storageKey, a.proxyKey, a.thumbKey, a.waveformKey, a.audioKey].filter((k): k is string => !!k));
  for (const e of exports) keys.push(...[e.storageKey, e.thumbKey, e.srtKey].filter((k): k is string => !!k));
  await Promise.allSettled(keys.map((k) => storage.delete(k)));
  await prisma.asset.deleteMany({ where: { projectId: id, userId } });
  await prisma.project.delete({ where: { id } });
  return json({ ok: true, deletedAssets: assets.length });
});

const Dup = z.object({ title: z.string().max(120).optional() });

export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const src = await own(id, userId);
  const body = await parseBody(req, Dup).catch(() => ({ title: undefined }));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } });
  const count = await prisma.project.count({ where: { userId, archived: false } });
  if (count >= projectLimit(user.plan)) throw new ApiError(402, `Your plan allows ${projectLimit(user.plan)} active projects. Archive one or upgrade to create more.`, { code: "PROJECT_LIMIT" });
  const current = src.currentVersionId ? await prisma.scriptVersion.findUnique({ where: { id: src.currentVersionId } }) : null;
  const copy = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        userId,
        title: body.title?.trim() || `${src.title} (copy)`,
        status: current ? (src.status === "FAILED" || src.status === "EXPORTING" ? "READY" : src.status) : "DRAFTING",
        statusMessage: null,
        brief: src.brief,
        aspect: src.aspect,
        platform: src.platform,
        targetDurationMs: src.targetDurationMs,
        recipeId: src.recipeId,
        referenceAssetId: src.referenceAssetId,
        plan: src.plan ?? undefined,
        thumbKey: src.thumbKey,
      },
    });
    if (current) {
      const v = await tx.scriptVersion.create({ data: { projectId: p.id, source: "IMPORT", script: current.script as object, summary: current.summary, label: `Duplicated from ${src.title}` } });
      await tx.project.update({ where: { id: p.id }, data: { currentVersionId: v.id } });
    }
    return tx.project.findUniqueOrThrow({ where: { id: p.id }, include: projectInclude });
  });
  return json(await projectToDTO(copy), { status: 201 });
});
