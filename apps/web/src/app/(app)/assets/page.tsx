import type { Metadata } from "next";
import { prisma } from "@vibe/db";
import { requireUser } from "@/lib/session";
import { assetToDTO, latestJobsForAssets } from "@/lib/dto";
import { AssetsView } from "@/components/assets/assets-view";

export const metadata: Metadata = { title: "Asset library" };
export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const user = await requireUser();
  const rows = await prisma.asset.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 300 });
  const jobs = await latestJobsForAssets(rows.filter((r) => r.status !== "READY").map((r) => r.id));
  const assets = await Promise.all(rows.map((r) => assetToDTO(r, jobs.get(r.id))));
  const folders = Array.from(new Set(rows.map((a) => a.folder).filter((f): f is string => !!f))).sort();
  const tags = Array.from(new Set(rows.flatMap((a) => a.tags))).sort();
  return <AssetsView initial={{ assets, folders, tags, total: rows.length }} />;
}
