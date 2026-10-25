/** Server-side asset helpers shared by API routes and server actions. */
import { prisma, type Asset } from "@vibe/db";
import { getStorage } from "@vibe/core";
import { ApiError } from "./session";

export async function ownAsset(id: string, userId: string): Promise<Asset> {
  const a = await prisma.asset.findUnique({ where: { id } });
  if (!a || a.userId !== userId) throw new ApiError(404, "Asset not found");
  return a;
}

/** Delete an asset's storage objects unless another asset row (a remix copy) still references the same file. */
export async function deleteAssetObjects(a: { id: string; storageKey: string; proxyKey: string | null; thumbKey: string | null; waveformKey: string | null; audioKey: string | null }) {
  const shared = await prisma.asset.count({ where: { storageKey: a.storageKey, id: { not: a.id } } });
  if (shared > 0) return;
  const storage = getStorage();
  const keys = [a.storageKey, a.proxyKey, a.thumbKey, a.waveformKey, a.audioKey].filter((k): k is string => !!k);
  await Promise.allSettled(keys.map((k) => storage.delete(k)));
}

/** Attach library assets to a project: unassigned ones are moved, ones used elsewhere are cloned (sharing storage objects). */
export async function attachAssets(userId: string, projectId: string, assetIds: string[]) {
  const assets = await prisma.asset.findMany({ where: { id: { in: assetIds }, userId } });
  for (const a of assets) {
    if (!a.projectId) {
      await prisma.asset.update({ where: { id: a.id }, data: { projectId } });
    } else if (a.projectId !== projectId) {
      const { id: _id, createdAt: _c, updatedAt: _u, analysis, ...rest } = a;
      await prisma.asset.create({ data: { ...rest, projectId, analysis: (analysis as object | null) ?? undefined, attribution: a.attribution ?? `copy-of:${a.id}` } });
    }
  }
}
