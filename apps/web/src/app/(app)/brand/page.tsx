import type { Metadata } from "next";
import { prisma } from "@vibe/db";
import { requireUser } from "@/lib/session";
import { assetToDTO } from "@/lib/dto";
import { BrandForm } from "@/components/brand/brand-form";
import type { AssetDTO, BrandKitDTO } from "@/lib/types";

export const metadata: Metadata = { title: "Brand kit" };
export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const user = await requireUser();
  const kit = await prisma.brandKit.findUnique({ where: { userId: user.id } });
  const dto: BrandKitDTO = kit
    ? { name: kit.name, handle: kit.handle, fonts: kit.fonts, colors: kit.colors, logoAssetId: kit.logoAssetId, introAssetId: kit.introAssetId, outroAssetId: kit.outroAssetId, defaultCaptionStyle: kit.defaultCaptionStyle, defaultMusicMood: kit.defaultMusicMood, voice: kit.voice }
    : { name: "My brand", handle: null, fonts: [], colors: [], logoAssetId: null, introAssetId: null, outroAssetId: null, defaultCaptionStyle: null, defaultMusicMood: null, voice: null };
  const ids = [dto.logoAssetId, dto.introAssetId, dto.outroAssetId].filter((x): x is string => !!x);
  const rows = ids.length ? await prisma.asset.findMany({ where: { id: { in: ids }, userId: user.id } }) : [];
  const assets: Record<string, AssetDTO | null> = {};
  for (const r of rows) assets[r.id] = await assetToDTO(r);
  return <BrandForm initial={dto} assets={assets} />;
}
