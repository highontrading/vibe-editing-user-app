import { z } from "zod";
import { prisma } from "@vibe/db";
import { enqueue } from "@vibe/core";
import { PlanSchema } from "@vibe/edl";
import { route, json, ApiError, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { ensureJobRunner } from "@/lib/jobs";
import { buildProjectView, getOwnedProject } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ plan: PlanSchema.optional(), brief: z.string().max(5000).optional() });

/** POST /api/projects/[id]/build {plan?, brief?} -> ProjectView. Saves the (edited) plan, sets BUILDING, enqueues `build`. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const existing = await getOwnedProject(userId, id);
  const text = await req.text();
  const body = Body.parse(text ? JSON.parse(text) : {});
  if (!body.plan && !existing.plan) throw new ApiError(409, "No plan to build from");
  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(body.plan ? { plan: body.plan as object } : {}),
      ...(body.brief !== undefined ? { brief: body.brief } : {}),
      status: "BUILDING",
      statusMessage: "Building your draft…",
    },
  });
  await ensureJobRunner();
  await enqueue("build", { projectId: id }, { userId, projectId: id });
  return json(serialize(await buildProjectView(project)));
});
