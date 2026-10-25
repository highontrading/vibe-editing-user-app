import { prisma, type AssetKind, type AssetStatus } from "@vibe/db";
import { json, route } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { assetToDTO, latestJobsForAssets } from "@/lib/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/assets?folder=&kind=&status=&q=&projectId=&tag= */
export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder");
  const kind = url.searchParams.get("kind") as AssetKind | null;
  const status = url.searchParams.get("status") as AssetStatus | null;
  const q = url.searchParams.get("q")?.trim();
  const projectId = url.searchParams.get("projectId");
  const tag = url.searchParams.get("tag");
  const limit = Math.min(500, Number(url.searchParams.get("limit") ?? 300));
  const rows = await prisma.asset.findMany({
    where: {
      userId,
      ...(folder ? (folder === "__none__" ? { folder: null } : { folder }) : {}),
      ...(kind ? { kind } : {}),
      ...(status ? { status } : {}),
      ...(projectId ? { projectId } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const jobs = await latestJobsForAssets(rows.filter((r) => r.status !== "READY").map((r) => r.id));
  const assets = await Promise.all(rows.map((r) => assetToDTO(r, jobs.get(r.id))));
  // folders + tags across the whole library (not just the filtered page)
  const all = await prisma.asset.findMany({ where: { userId }, select: { folder: true, tags: true } });
  const folders = Array.from(new Set(all.map((a) => a.folder).filter((f): f is string => !!f))).sort();
  const tags = Array.from(new Set(all.flatMap((a) => a.tags))).sort();
  return json({ assets, folders, tags, total: all.length });
});
