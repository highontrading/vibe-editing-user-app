/** Dev-only plan switch (when Stripe is not configured and NODE_ENV !== production). */
import { z } from "zod";
import { prisma } from "@vibe/db";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { quotaForPlan, stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

const Body = z.object({ plan: z.enum(["FREE", "CREATOR", "PRO", "STUDIO"]) });

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  if (process.env.NODE_ENV === "production" || stripeConfigured()) throw new ApiError(403, "Plan switching is only available in development without Stripe");
  const { plan } = await parseBody(req, Body);
  const user = await prisma.user.update({ where: { id: userId }, data: { plan, minutesQuota: quotaForPlan(plan), minutesUsed: 0, cycleStartedAt: new Date(), planRenewsAt: null } });
  return json({ plan: user.plan, minutesQuota: user.minutesQuota });
});
