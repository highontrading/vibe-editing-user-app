import { prisma } from "@vibe/db";
import { route, json, ApiError, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getOwnedProject, toVersionWithScript } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; versionId: string }> };

/** GET /api/projects/[id]/versions/[versionId] -> VersionWithScript (urls resolved) */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id, versionId } = await ctx.params;
  await getOwnedProject(userId, id);
  const version = await prisma.scriptVersion.findFirst({ where: { id: versionId, projectId: id } });
  if (!version) throw new ApiError(404, "Version not found");
  return json(serialize(await toVersionWithScript(version)));
});
