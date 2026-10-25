import { z } from "zod";
import { prisma } from "@vibe/db";
import { enqueue } from "@vibe/core";
import { ASPECTS, PLATFORMS, PlanSchema } from "@vibe/edl";
import { route, json, parseBody, ApiError, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { ensureJobRunner } from "@/lib/jobs";
import { buildProjectView, getOwnedProject } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const PostBody = z
  .object({
    brief: z.string().max(5000).optional(),
    aspect: z.enum(ASPECTS).optional(),
    platform: z.enum(PLATFORMS).optional(),
    targetDurationMs: z.number().int().positive().nullable().optional(),
  })
  .optional();

/** POST /api/projects/[id]/plan {brief?, aspect?, platform?, targetDurationMs?} -> ProjectView. Sets PLANNING and enqueues `plan`. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await getOwnedProject(userId, id);
  const text = await req.text();
  const body = PostBody.parse(text ? JSON.parse(text) : undefined) ?? {};
  const assets = await prisma.asset.findMany({ where: { projectId: id }, select: { status: true } });
  if (assets.length === 0) throw new ApiError(409, "Add footage before making a plan");
  if (assets.some((a) => a.status !== "READY")) throw new ApiError(409, "Wait until all footage is analysed");
  const project = await prisma.project.update({
    where: { id },
    data: { ...body, status: "PLANNING", statusMessage: "Writing your edit plan…" },
  });
  await ensureJobRunner();
  await enqueue("plan", { projectId: id }, { userId, projectId: id });
  return json(serialize(await buildProjectView(project)));
});

const PatchBody = z.object({ plan: PlanSchema, brief: z.string().max(5000).optional() });

/** PATCH /api/projects/[id]/plan {plan, brief?} -> {plan}. Saves the user's edited plan. */
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await getOwnedProject(userId, id);
  const body = await parseBody(req, PatchBody);
  const project = await prisma.project.update({
    where: { id },
    data: { plan: body.plan as object, ...(body.brief !== undefined ? { brief: body.brief } : {}) },
  });
  return json(serialize({ plan: project.plan, brief: project.brief }));
});
