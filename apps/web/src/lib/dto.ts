/**
 * Server-side mappers from Prisma rows to the client DTOs in ./types.
 */
import { prisma, type Asset, type Project, type Recipe, type Job, type User } from "@vibe/db";
import { getStorage, storageKeys } from "@vibe/core";
import { mediaUrl, withMediaUrls } from "./media-url";
import type { AssetDTO, JobDTO, MeDTO, ProjectDTO, RecipeDTO, Preferences } from "./types";

export async function assetToDTO(a: Asset, job?: Job | null, includeAnalysis = false): Promise<AssetDTO> {
  const m = await withMediaUrls(a);
  let stripUrl: string | null | undefined;
  if (includeAnalysis && a.kind === "VIDEO" && a.status === "READY") {
    const key = storageKeys().derived(a.id, "strip.jpg");
    stripUrl = (await getStorage().exists(key).catch(() => false)) ? await mediaUrl(key) : null;
  }
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    source: a.source,
    status: a.status,
    mime: a.mime,
    sizeBytes: Number(a.sizeBytes),
    durationMs: a.durationMs,
    width: a.width,
    height: a.height,
    fps: a.fps,
    folder: a.folder,
    tags: a.tags,
    projectId: a.projectId,
    error: a.error,
    analysisStep: a.analysisStep,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    url: m.url,
    thumbUrl: m.thumbUrl,
    proxyUrl: m.proxyUrl,
    waveformUrl: m.waveformUrl,
    stripUrl,
    job: job ? { status: job.status, message: job.message, progress: job.progress, error: job.error } : null,
    analysis: includeAnalysis ? ((a.analysis as AssetDTO["analysis"]) ?? null) : undefined,
  };
}

/** Latest job per asset id (for status messages). */
export async function latestJobsForAssets(assetIds: string[]): Promise<Map<string, Job>> {
  const map = new Map<string, Job>();
  if (!assetIds.length) return map;
  const jobs = await prisma.job.findMany({ where: { assetId: { in: assetIds } }, orderBy: { createdAt: "desc" } });
  for (const j of jobs) if (j.assetId && !map.has(j.assetId)) map.set(j.assetId, j);
  return map;
}

type ProjectRow = Project & { recipe?: Pick<Recipe, "slug" | "title" | "category"> | null; current?: { script: unknown } | null; _count?: { assets: number; exports: number } };

export async function projectToDTO(p: ProjectRow): Promise<ProjectDTO> {
  const script = p.current?.script as { output?: { durationMs?: number } } | null | undefined;
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    statusMessage: p.statusMessage,
    brief: p.brief,
    aspect: p.aspect,
    platform: p.platform,
    targetDurationMs: p.targetDurationMs,
    recipeId: p.recipeId,
    recipe: p.recipe ? { slug: p.recipe.slug, title: p.recipe.title, category: p.recipe.category } : null,
    thumbUrl: await mediaUrl(p.thumbKey),
    durationMs: script?.output?.durationMs ?? null,
    archived: p.archived,
    assetCount: p._count?.assets ?? 0,
    exportCount: p._count?.exports ?? 0,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const projectInclude = { recipe: { select: { slug: true, title: true, category: true } }, current: { select: { script: true } }, _count: { select: { assets: true, exports: true } } } as const;

export async function recipeToDTO(r: Recipe): Promise<RecipeDTO> {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    category: r.category,
    description: r.description,
    bring: r.bring,
    sizes: r.sizes,
    prompt: r.prompt,
    defaults: (r.defaults as Record<string, unknown>) ?? {},
    previewUrl: r.previewUrl ?? (await mediaUrl(r.previewKey)),
    tags: r.tags,
    usesGenerative: r.usesGenerative,
    isPublic: r.isPublic,
    isFeatured: r.isFeatured,
    ownerId: r.ownerId,
    usageCount: r.usageCount,
    createdAt: r.createdAt.toISOString(),
  };
}

export function jobToDTO(j: Job): JobDTO {
  return { id: j.id, type: j.type, status: j.status, progress: j.progress, message: j.message, error: j.error, assetId: j.assetId, projectId: j.projectId, createdAt: j.createdAt.toISOString(), updatedAt: j.updatedAt.toISOString() };
}

export function userToMe(u: User): MeDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    plan: u.plan,
    minutesQuota: u.minutesQuota,
    minutesUsed: u.minutesUsed,
    cycleStartedAt: u.cycleStartedAt.toISOString(),
    planRenewsAt: u.planRenewsAt?.toISOString() ?? null,
    onboarded: u.onboarded,
    preferences: (u.preferences as Preferences) ?? {},
    hasPassword: !!u.passwordHash,
    stripeCustomerId: u.stripeCustomerId,
    createdAt: u.createdAt.toISOString(),
  };
}
