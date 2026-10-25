import { prisma } from "@vibe/db";
import { json, route } from "@/lib/api";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export const POST = route(async () => {
  const userId = await requireUserId();
  await prisma.user.update({ where: { id: userId }, data: { onboarded: true } });
  return json({ ok: true });
});
