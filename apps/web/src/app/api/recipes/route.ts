import { z } from "zod";
import { prisma } from "@vibe/db";
import { slugify } from "@vibe/core";
import { ASPECTS } from "@vibe/edl";
import { json, parseBody, route } from "@/lib/api";
import { currentUserId, requireUserId, ApiError } from "@/lib/session";
import { recipeToDTO } from "@/lib/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const userId = await currentUserId();
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const q = url.searchParams.get("q")?.trim();
  const mine = url.searchParams.get("mine") === "1";
  const rows = await prisma.recipe.findMany({
    where: {
      AND: [
        mine ? { ownerId: userId ?? "__none__" } : { OR: [{ isPublic: true }, ...(userId ? [{ ownerId: userId }] : [])] },
        category ? { category } : {},
        q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { tags: { has: q.toLowerCase() } }] } : {},
      ],
    },
    orderBy: [{ isFeatured: "desc" }, { usageCount: "desc" }, { createdAt: "desc" }],
  });
  return json({ recipes: await Promise.all(rows.map(recipeToDTO)) });
});

const Create = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  description: z.string().max(400).optional(),
  bring: z.string().max(200).optional(),
  prompt: z.string().max(5000).optional(),
  defaults: z.record(z.string(), z.unknown()).optional(),
  sizes: z.array(z.enum(ASPECTS)).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

/** Save a project as a private recipe. */
export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await parseBody(req, Create);
  const project = await prisma.project.findUnique({ where: { id: body.projectId }, include: { recipe: true } });
  if (!project || project.userId !== userId) throw new ApiError(404, "Project not found");
  const plan = (project.plan as { captionStyle?: string; musicMood?: string; colorPreset?: string; summary?: string } | null) ?? null;
  const base = slugify(body.title);
  let slug = `${base}-${userId.slice(-4).toLowerCase()}`;
  for (let i = 2; await prisma.recipe.findUnique({ where: { slug } }); i++) slug = `${base}-${userId.slice(-4).toLowerCase()}-${i}`;
  const defaults = {
    ...(project.recipe?.defaults as Record<string, unknown> | undefined),
    ...(plan?.captionStyle ? { captionStyle: plan.captionStyle } : {}),
    ...(plan?.musicMood ? { musicMood: plan.musicMood } : {}),
    ...(plan?.colorPreset ? { colorPreset: plan.colorPreset } : {}),
    ...(project.targetDurationMs ? { targetDurationMs: project.targetDurationMs } : {}),
    platform: project.platform,
    ...(body.defaults ?? {}),
  };
  const recipe = await prisma.recipe.create({
    data: {
      slug,
      title: body.title.trim(),
      category: body.category.trim(),
      description: body.description?.trim() || plan?.summary || project.brief?.slice(0, 300) || `Saved from ${project.title}`,
      bring: body.bring?.trim() || project.recipe?.bring || "Your own clips",
      sizes: body.sizes?.length ? body.sizes : [project.aspect],
      prompt: body.prompt?.trim() || project.brief || project.recipe?.prompt || "Edit in the same style as the source project.",
      defaults,
      tags: body.tags ?? [],
      previewKey: project.thumbKey,
      isPublic: false,
      ownerId: userId,
    },
  });
  return json(await recipeToDTO(recipe), { status: 201 });
});
