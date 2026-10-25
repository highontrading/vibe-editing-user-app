import { z } from "zod";
import { prisma } from "@vibe/db";
import { parseScript } from "@vibe/edl";
import { route, json, ApiError, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { createVersion, getOwnedProject, toVersionView } from "@/lib/editor/project-service";
import { resolveScriptUrls } from "@/lib/editor/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; versionId: string }> };

const Body = z.object({ label: z.string().max(120).optional() });

/** POST /api/projects/[id]/versions/[versionId]/restore {label?} -> {version, script}. Copies the version and makes the copy current. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id, versionId } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const text = await req.text();
  const body = Body.parse(text ? JSON.parse(text) : {});
  const source = await prisma.scriptVersion.findFirst({ where: { id: versionId, projectId: id } });
  if (!source) throw new ApiError(404, "Version not found");
  const script = parseScript(source.script);
  const label = (body.label ?? `Restored: ${source.label ?? source.summary}`).slice(0, 120);
  const version = await createVersion(project, script, { source: "USER", label, parentId: source.id });
  if (project.status === "FAILED") await prisma.project.update({ where: { id }, data: { status: "READY" } });
  return json(serialize({ version: toVersionView(version), script: await resolveScriptUrls(script) }));
});
