import { z } from "zod";
import { prisma } from "@vibe/db";
import { CAPTION_STYLE_IDS, MUSIC_MOODS } from "@vibe/edl";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import type { BrandKitDTO } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY: BrandKitDTO = { name: "My brand", handle: null, fonts: [], colors: [], logoAssetId: null, introAssetId: null, outroAssetId: null, defaultCaptionStyle: null, defaultMusicMood: null, voice: null };

export const GET = route(async () => {
  const userId = await requireUserId();
  const kit = await prisma.brandKit.findUnique({ where: { userId } });
  return json<BrandKitDTO>(kit ? { name: kit.name, handle: kit.handle, fonts: kit.fonts, colors: kit.colors, logoAssetId: kit.logoAssetId, introAssetId: kit.introAssetId, outroAssetId: kit.outroAssetId, defaultCaptionStyle: kit.defaultCaptionStyle, defaultMusicMood: kit.defaultMusicMood, voice: kit.voice } : EMPTY);
});

const Body = z.object({
  name: z.string().min(1).max(60),
  handle: z.string().max(40).nullable().optional(),
  fonts: z.array(z.string().max(40)).max(3).optional(),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(5).optional(),
  logoAssetId: z.string().nullable().optional(),
  introAssetId: z.string().nullable().optional(),
  outroAssetId: z.string().nullable().optional(),
  defaultCaptionStyle: z.enum(CAPTION_STYLE_IDS).nullable().optional(),
  defaultMusicMood: z.enum(MUSIC_MOODS).nullable().optional(),
  voice: z.string().max(60).nullable().optional(),
});

export const PUT = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await parseBody(req, Body);
  for (const key of ["logoAssetId", "introAssetId", "outroAssetId"] as const) {
    const id = body[key];
    if (id) {
      const a = await prisma.asset.findUnique({ where: { id }, select: { userId: true } });
      if (!a || a.userId !== userId) body[key] = null;
    }
  }
  const data = { name: body.name.trim(), handle: body.handle?.trim().replace(/^@/, "") || null, fonts: body.fonts ?? [], colors: body.colors ?? [], logoAssetId: body.logoAssetId ?? null, introAssetId: body.introAssetId ?? null, outroAssetId: body.outroAssetId ?? null, defaultCaptionStyle: body.defaultCaptionStyle ?? null, defaultMusicMood: body.defaultMusicMood ?? null, voice: body.voice ?? null };
  const kit = await prisma.brandKit.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return json<BrandKitDTO>({ name: kit.name, handle: kit.handle, fonts: kit.fonts, colors: kit.colors, logoAssetId: kit.logoAssetId, introAssetId: kit.introAssetId, outroAssetId: kit.outroAssetId, defaultCaptionStyle: kit.defaultCaptionStyle, defaultMusicMood: kit.defaultMusicMood, voice: kit.voice });
});
