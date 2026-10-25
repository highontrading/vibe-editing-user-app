/**
 * Builds the ProjectContext the agent reads (assets + analysis, recipe, brand
 * kit, user preferences, reference video). Exported for the web app so the
 * chat route can build the same context without duplicating this code.
 */
import { prisma, type Asset } from "@vibe/db";
import { AssetAnalysisSchema, type AssetAnalysis, type AssetRef } from "@vibe/edl";
import type { AgentAsset, ProjectContext } from "@vibe/agent";
import { assetKindToRef, assetSourceToRef } from "./util";

/** AssetRef for a DB row. `url` is a storage key: the proxy when there is one, else the original. */
export function assetRefFromRow(a: Asset): AssetRef {
  return {
    id: a.id,
    kind: assetKindToRef(a.kind),
    url: a.proxyKey ?? a.storageKey,
    name: a.name,
    durationMs: a.durationMs ?? undefined,
    width: a.width ?? undefined,
    height: a.height ?? undefined,
    source: assetSourceToRef(a.source),
    attribution: a.attribution ?? undefined,
  };
}

export function parseAnalysis(json: unknown): AssetAnalysis | null {
  if (!json || typeof json !== "object") return null;
  const r = AssetAnalysisSchema.safeParse(json);
  return r.success ? r.data : null;
}

export function agentAssetFromRow(a: Asset): AgentAsset {
  return { ref: assetRefFromRow(a), analysis: parseAnalysis(a.analysis) };
}

export async function createContext(projectId: string): Promise<ProjectContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assets: { where: { status: "READY", source: { not: "RENDER" } }, orderBy: { createdAt: "asc" } },
      recipe: true,
      user: { include: { brandKit: true } },
    },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);

  let reference: AgentAsset | null = null;
  if (project.referenceAssetId) {
    const ref = await prisma.asset.findUnique({ where: { id: project.referenceAssetId } });
    if (ref) reference = agentAssetFromRow(ref);
  }

  const brand = project.user.brandKit;
  const prefs = (project.user.preferences ?? {}) as Record<string, unknown>;

  return {
    projectId: project.id,
    brief: project.brief ?? "",
    aspect: project.aspect,
    platform: project.platform,
    targetDurationMs: project.targetDurationMs,
    assets: project.assets.filter((a) => a.id !== project.referenceAssetId).map(agentAssetFromRow),
    recipe: project.recipe
      ? { slug: project.recipe.slug, title: project.recipe.title, category: project.recipe.category, prompt: project.recipe.prompt, defaults: (project.recipe.defaults ?? {}) as Record<string, unknown> }
      : null,
    brand: brand
      ? {
          handle: brand.handle,
          fonts: brand.fonts,
          colors: brand.colors,
          logoAssetId: brand.logoAssetId,
          introAssetId: brand.introAssetId,
          outroAssetId: brand.outroAssetId,
          defaultCaptionStyle: brand.defaultCaptionStyle,
          defaultMusicMood: brand.defaultMusicMood,
        }
      : null,
    preferences: prefs,
    reference,
  };
}
