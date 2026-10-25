import { z } from "zod";
import { prisma } from "@vibe/db";
import { env } from "@vibe/core";
import { json, parseBody, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { getStripe, priceForPlan } from "@/lib/stripe";

export const runtime = "nodejs";

const Body = z.object({ plan: z.enum(["CREATOR", "PRO", "STUDIO"]) });

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const { plan } = await parseBody(req, Body);
  const stripe = getStripe();
  if (!stripe) throw new ApiError(503, "Billing is not configured", { code: "BILLING_NOT_CONFIGURED" });
  const price = priceForPlan(plan);
  if (!price) throw new ApiError(503, `No Stripe price configured for ${plan}`, { code: "PRICE_MISSING" });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  let customer = user.stripeCustomerId ?? undefined;
  if (!customer) {
    const c = await stripe.customers.create({ email: user.email, name: user.name ?? undefined, metadata: { userId } });
    customer = c.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer } });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${env.appUrl}/billing?checkout=success`,
    cancel_url: `${env.appUrl}/billing?checkout=cancelled`,
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
  });
  return json({ url: session.url });
});
