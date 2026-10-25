import { z } from "zod";
import { prisma } from "@vibe/db";
import { getStorage } from "@vibe/core";
import { ASPECTS } from "@vibe/edl";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { userToMe } from "@/lib/dto";

export const runtime = "nodejs";

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  preferences: z
    .object({
      defaultAspect: z.enum(["auto", ...ASPECTS]).optional(),
      defaultPlatform: z.string().max(20).optional(),
      captions: z.boolean().optional(),
      music: z.boolean().optional(),
      removeFillers: z.boolean().optional(),
      language: z.string().max(10).optional(),
    })
    .optional(),
  onboarded: z.boolean().optional(),
});

export const PATCH = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await parseBody(req, Patch);
  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const prefs = { ...((current.preferences as Record<string, unknown>) ?? {}), ...(body.preferences ?? {}) };
  const user = await prisma.user.update({ where: { id: userId }, data: { ...(body.name !== undefined ? { name: body.name.trim() } : {}), ...(body.preferences ? { preferences: prefs } : {}), ...(body.onboarded !== undefined ? { onboarded: body.onboarded } : {}) } });
  return json(userToMe(user));
});

/** Delete the account and everything it owns, including storage objects. */
export const DELETE = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await parseBody(req, z.object({ confirm: z.string() })).catch(() => ({ confirm: "" }));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (body.confirm.trim().toLowerCase() !== user.email.toLowerCase()) throw new ApiError(400, "Type your email address to confirm");
  const storage = getStorage();
  const [assets, exports] = await Promise.all([prisma.asset.findMany({ where: { userId } }), prisma.export.findMany({ where: { project: { userId } } })]);
  const keys: string[] = [];
  for (const a of assets) keys.push(...[a.storageKey, a.proxyKey, a.thumbKey, a.waveformKey, a.audioKey].filter((k): k is string => !!k));
  for (const e of exports) keys.push(...[e.storageKey, e.thumbKey, e.srtKey].filter((k): k is string => !!k));
  if (user.image?.includes("/api/storage/")) keys.push(decodeURIComponent(user.image.split("/api/storage/")[1]!.split("?")[0]!));
  await Promise.allSettled(keys.map((k) => storage.delete(k)));
  await prisma.user.delete({ where: { id: userId } });
  return json({ ok: true, deletedObjects: keys.length });
});
