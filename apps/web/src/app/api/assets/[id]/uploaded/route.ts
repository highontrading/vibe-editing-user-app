/** POST /api/assets/[id]/uploaded -> marks the asset UPLOADED and enqueues ingest. */
import { prisma } from "@vibe/db";
import { enqueue, getStorage } from "@vibe/core";
import { json, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { ensureJobRunner } from "@/lib/jobs";
import { assetToDTO } from "@/lib/dto";

export const runtime = "nodejs";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const a = await prisma.asset.findUnique({ where: { id } });
  if (!a || a.userId !== userId) throw new ApiError(404, "Asset not found");
  if (a.status !== "UPLOADING") return json(await assetToDTO(a));
  const storage = getStorage();
  if (!(await storage.exists(a.storageKey))) throw new ApiError(400, "Upload not found in storage");
  const updated = await prisma.asset.update({ where: { id }, data: { status: "UPLOADED", error: null } });
  if (a.projectId) {
    // Footage arriving in a fresh project means we are now understanding it; analyze enqueues the plan when all assets are READY.
    await prisma.project.updateMany({ where: { id: a.projectId, status: "DRAFTING" }, data: { status: "ANALYZING", statusMessage: "Understanding your footage" } });
  }
  await ensureJobRunner();
  let job = null;
  try {
    job = await enqueue("ingest", { assetId: id }, { userId, assetId: id, projectId: a.projectId ?? undefined });
  } catch (e) {
    console.error("[assets/uploaded] enqueue failed", e);
  }
  return json({ ...(await assetToDTO(updated)), jobId: job?.id ?? null });
});
