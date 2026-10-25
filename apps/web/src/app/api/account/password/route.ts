import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@vibe/db";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({ current: z.string().optional(), next: z.string().min(8).max(200) });

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await parseBody(req, Body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.passwordHash) {
    if (!body.current || !(await bcrypt.compare(body.current, user.passwordHash))) throw new ApiError(400, "Current password is incorrect");
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(body.next, 10) } });
  return json({ ok: true });
});
