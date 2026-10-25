import { prisma } from "@vibe/db";
import { enqueue } from "@vibe/core";
import { route, json, ApiError, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { ensureJobRunner } from "@/lib/jobs";
import { getOwnedProject, toAssetView, toJobView } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; assetId: string }> };

/** POST /api/projects/[id]/assets/[assetId]/uploaded -> { asset, job }. Marks UPLOADED, moves the project to ANALYZING and enqueues `ingest`. */
export const POST = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id, assetId } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const existing = await prisma.asset.findFirst({ where: { id: assetId, projectId: id, userId } });
  if (!existing) throw new ApiError(404, "Asset not found");
  const asset = await prisma.asset.update({ where: { id: assetId }, data: { status: "UPLOADED", error: null } });
  if (project.status === "DRAFTING") {
    await prisma.project.update({ where: { id }, data: { status: "ANALYZING", statusMessage: "Understanding your footage…" } });
  }
  await ensureJobRunner();
  let job = null;
  try {
    job = await enqueue("ingest", { assetId }, { userId, projectId: id, assetId });
  } catch (e) {
    console.error("[assets/uploaded] enqueue failed", e);
  }
  return json(serialize({ asset: await toAssetView(asset), job: job ? toJobView(job) : null }));
});
