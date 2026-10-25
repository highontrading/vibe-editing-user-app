import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@vibe/db";
import { slugify } from "@vibe/core";
import { type Plan } from "@vibe/edl";
import { route, json, parseBody, ApiError, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getOwnedProject } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ title: z.string().trim().min(1).max(120).optional(), description: z.string().max(1000).optional(), category: z.string().max(60).optional() });

/** POST /api/projects/[id]/recipe {title?, description?, category?} -> { recipe }. Private recipe from the project's plan + brief. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const text = await req.text();
  const body = Body.parse(text ? JSON.parse(text) : {});
  const plan = project.plan as Plan | null;
  if (!plan && !project.brief) throw new ApiError(409, "This project has no plan or brief to save");
  const assets = await prisma.asset.findMany({ where: { projectId: id }, select: { kind: true, durationMs: true } });
  const totalMs = assets.reduce((n, a) => n + (a.durationMs ?? 0), 0);
  const title = body.title ?? plan?.title ?? project.title;
  const steps = (plan?.steps ?? []).filter((s) => s.enabled).map((s) => `- ${s.text}`);
  const prompt = [project.brief?.trim(), steps.length ? `Follow these steps:\n${steps.join("\n")}` : null].filter(Boolean).join("\n\n") || plan?.summary || title;
  const recipe = await prisma.recipe.create({
    data: {
      slug: `${slugify(title)}-${crypto.randomBytes(3).toString("hex")}`,
      title,
      category: body.category ?? "Custom",
      description: body.description ?? plan?.summary ?? project.brief?.slice(0, 200) ?? "",
      bring: assets.length ? `${assets.length} clip${assets.length === 1 ? "" : "s"}${totalMs ? `, about ${Math.max(1, Math.round(totalMs / 60000))} min total` : ""}` : "Your footage",
      sizes: [project.aspect],
      prompt,
      defaults: {
        captionStyle: plan?.captionStyle,
        musicMood: plan?.musicMood,
        colorPreset: plan?.colorPreset,
        targetDurationMs: project.targetDurationMs ?? plan?.targetDurationMs,
        platform: project.platform,
        aspect: project.aspect,
        steps: plan?.steps ?? [],
      } as object,
      tags: ["custom"],
      isPublic: false,
      ownerId: userId,
    },
  });
  return json(serialize({ recipe }));
});
