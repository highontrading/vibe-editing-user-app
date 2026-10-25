import { prisma } from "@vibe/db";
import { parseScript } from "@vibe/edl";
import { route, json, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getOwnedProject } from "@/lib/editor/project-service";
import { resolveScriptUrls } from "@/lib/editor/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/projects/[id]/script?resolved=1&versionId=... -> { versionId, script } */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const url = new URL(req.url);
  const versionId = url.searchParams.get("versionId") ?? project.currentVersionId;
  if (!versionId) throw new ApiError(404, "Project has no edit yet");
  const version = await prisma.scriptVersion.findFirst({ where: { id: versionId, projectId: id } });
  if (!version) throw new ApiError(404, "Version not found");
  let script = parseScript(version.script);
  if (url.searchParams.get("resolved") === "1") script = await resolveScriptUrls(script);
  return json({ versionId: version.id, script });
});
