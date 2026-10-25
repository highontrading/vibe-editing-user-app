import { prisma } from "@vibe/db";
import { env } from "@vibe/core";
import { json, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export const POST = route(async () => {
  const userId = await requireUserId();
  const stripe = getStripe();
  if (!stripe) throw new ApiError(503, "Billing is not configured", { code: "BILLING_NOT_CONFIGURED" });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.stripeCustomerId) throw new ApiError(400, "No billing account yet. Pick a plan first.");
  const session = await stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${env.appUrl}/billing` });
  return json({ url: session.url });
});
