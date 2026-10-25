import { prisma } from "@vibe/db";
import { route, json, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getOwnedProject } from "@/lib/editor/project-service";
import type { VersionView } from "@/lib/editor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/projects/[id]/versions -> { currentVersionId, versions: VersionView[] } newest first */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const limit = Math.min(200, Number(new URL(req.url).searchParams.get("limit") ?? 100) || 100);
  const rows = await prisma.scriptVersion.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, parentId: true, source: true, summary: true, label: true, createdAt: true },
  });
  const versions: VersionView[] = rows.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }));
  return json(serialize({ currentVersionId: project.currentVersionId, versions }));
});
