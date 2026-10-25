import { z } from "zod";
import { prisma } from "@vibe/db";
import { ASPECTS, PLATFORMS } from "@vibe/edl";
import { route, json, parseBody, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { buildProjectView, getOwnedProject } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  return json(serialize(await buildProjectView(project)));
});

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  brief: z.string().max(5000).nullable().optional(),
  aspect: z.enum(ASPECTS).optional(),
  platform: z.enum(PLATFORMS).optional(),
  targetDurationMs: z.number().int().positive().nullable().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await getOwnedProject(userId, id);
  const body = await parseBody(req, PatchSchema);
  const project = await prisma.project.update({ where: { id }, data: body });
  return json(serialize(await buildProjectView(project)));
});
