import { prisma } from "@vibe/db";
import { json, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { userToMe } from "@/lib/dto";
import { limitsFor, usageSummary } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const id = await requireUserId();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ApiError(404, "User not found");
  const usage = usageSummary(user);
  return json({ ...userToMe(user), usage: { ...usage, resetsAt: usage.resetsAt.toISOString() }, limits: limitsFor(user.plan) });
});
