import { z } from "zod";
import { prisma } from "@vibe/db";
import { titleFromBrief } from "@vibe/core";
import { ASPECTS, PLATFORMS } from "@vibe/edl";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { projectInclude, projectToDTO } from "@/lib/dto";
import { projectLimit } from "@/lib/plan";
import { detectPlatform } from "@/lib/options";
import { attachAssets } from "@/lib/assets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const archived = url.searchParams.get("archived");
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 100));
  const q = url.searchParams.get("q")?.trim();
  const rows = await prisma.project.findMany({
    where: { userId, ...(archived === "all" ? {} : { archived: archived === "1" }), ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: projectInclude,
  });
  return json({ projects: await Promise.all(rows.map(projectToDTO)) });
});

const CreateBody = z.object({
  brief: z.string().max(5000).optional().default(""),
  aspect: z.enum([...ASPECTS, "auto"]).optional().default("auto"),
  platform: z.enum(PLATFORMS).optional(),
  /** 0/undefined = auto, -1 = full length */
  targetDurationMs: z.number().int().optional().nullable(),
  recipeSlug: z.string().optional(),
  recipeId: z.string().optional(),
  title: z.string().max(120).optional(),
  twist: z.string().max(1000).optional(),
  /** Library assets to bring into the project. Unassigned assets are attached; assets that belong to another project are cloned (same storage objects). */
  assetIds: z.array(z.string()).max(200).optional(),
});

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await parseBody(req, CreateBody);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, preferences: true } });
  const count = await prisma.project.count({ where: { userId, archived: false } });
  const limit = projectLimit(user.plan);
  if (count >= limit) throw new ApiError(402, `Your plan allows ${limit} active projects. Archive one or upgrade to create more.`, { code: "PROJECT_LIMIT", limit });

  const recipe = body.recipeId ? await prisma.recipe.findUnique({ where: { id: body.recipeId } }) : body.recipeSlug ? await prisma.recipe.findUnique({ where: { slug: body.recipeSlug } }) : null;
  if ((body.recipeId || body.recipeSlug) && !recipe) throw new ApiError(404, "Recipe not found");
  if (recipe && !recipe.isPublic && recipe.ownerId !== userId) throw new ApiError(403, "Recipe is private");

  const prefs = (user.preferences as { defaultAspect?: string; defaultPlatform?: string }) ?? {};
  const detected = detectPlatform(body.brief ?? "");
  const defaults = (recipe?.defaults as { platform?: string; targetDurationMs?: number } | null) ?? null;
  let platform = body.platform ?? detected?.platform ?? defaults?.platform ?? (prefs.defaultPlatform && prefs.defaultPlatform !== "auto" ? prefs.defaultPlatform : undefined);
  let aspect: string = body.aspect;
  if (aspect === "auto") {
    aspect = detected?.aspect ?? (prefs.defaultAspect && prefs.defaultAspect !== "auto" ? prefs.defaultAspect : recipe?.sizes?.[0] ?? (platform ? platformAspect(platform) : "9:16"));
  }
  if (!platform) platform = aspect === "16:9" ? "youtube" : aspect === "1:1" ? "linkedin" : "tiktok";
  const targetDurationMs = body.targetDurationMs === undefined || body.targetDurationMs === 0 ? (defaults?.targetDurationMs ?? null) : body.targetDurationMs === -1 ? null : body.targetDurationMs;
  const briefParts = [body.brief?.trim(), body.twist?.trim() ? `Twist: ${body.twist.trim()}` : ""].filter(Boolean);
  const brief = briefParts.join("\n") || null;
  const title = body.title?.trim() || (recipe ? `${recipe.title}${brief ? ` · ${titleFromBrief(brief, "")}` : ""}` : titleFromBrief(brief));

  const project = await prisma.project.create({
    data: { userId, title: title.slice(0, 120), brief, aspect, platform, targetDurationMs, recipeId: recipe?.id ?? null, status: "DRAFTING" },
    include: projectInclude,
  });
  if (recipe) await prisma.recipe.update({ where: { id: recipe.id }, data: { usageCount: { increment: 1 } } }).catch(() => {});
  if (body.assetIds?.length) await attachAssets(userId, project.id, body.assetIds);
  const fresh = await prisma.project.findUniqueOrThrow({ where: { id: project.id }, include: projectInclude });
  return json(await projectToDTO(fresh), { status: 201 });
});

function platformAspect(platform: string) {
  if (["tiktok", "reels", "shorts"].includes(platform)) return "9:16";
  if (platform === "linkedin") return "1:1";
  return "16:9";
}
