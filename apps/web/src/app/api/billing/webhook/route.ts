/**
 * Stripe webhook. Handles checkout.session.completed and
 * customer.subscription.updated/deleted. Event ids are stored in StripeEvent
 * for idempotency.
 */
import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma, type Plan } from "@vibe/db";
import { env } from "@vibe/core";
import { getStripe, planForPrice, quotaForPlan } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function applyPlan(userId: string, plan: Plan, extra: { stripeCustomerId?: string | null; stripeSubscriptionId?: string | null; planRenewsAt?: Date | null } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const changed = user.plan !== plan;
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      minutesQuota: quotaForPlan(plan),
      ...(changed ? { minutesUsed: 0, cycleStartedAt: new Date() } : {}),
      ...(extra.stripeCustomerId !== undefined ? { stripeCustomerId: extra.stripeCustomerId } : {}),
      ...(extra.stripeSubscriptionId !== undefined ? { stripeSubscriptionId: extra.stripeSubscriptionId } : {}),
      ...(extra.planRenewsAt !== undefined ? { planRenewsAt: extra.planRenewsAt } : {}),
    },
  });
  if (changed) await prisma.creditLedger.create({ data: { userId, minutes: quotaForPlan(plan), reason: `plan:${plan}`, ref: extra.stripeSubscriptionId ?? null } }).catch(() => {});
}

async function userIdForCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined, metadata?: Stripe.Metadata | null) {
  if (metadata?.userId) return metadata.userId;
  const id = typeof customer === "string" ? customer : customer?.id;
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { stripeCustomerId: id }, select: { id: true } });
  return u?.id ?? null;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const ts = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const cfg = env.stripe;
  if (!stripe || !cfg) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    if (!cfg.webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET missing");
    event = stripe.webhooks.constructEvent(raw, sig ?? "", cfg.webhookSecret);
  } catch (e) {
    return NextResponse.json({ error: `Webhook signature failed: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }
  // idempotency
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const userId = s.client_reference_id ?? (await userIdForCustomer(s.customer, s.metadata));
        const plan = (s.metadata?.plan as Plan | undefined) ?? null;
        if (userId && plan) {
          const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null;
          let renews: Date | null = null;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            renews = periodEnd(sub);
          }
          await applyPlan(userId, plan, { stripeCustomerId: typeof s.customer === "string" ? s.customer : s.customer?.id ?? null, stripeSubscriptionId: subId, planRenewsAt: renews });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object;
        const userId = await userIdForCustomer(sub.customer, sub.metadata);
        if (!userId) break;
        const active = ["active", "trialing", "past_due"].includes(sub.status);
        const plan = active ? ((sub.metadata?.plan as Plan | undefined) ?? planForPrice(sub.items.data[0]?.price?.id) ?? "CREATOR") : "FREE";
        await applyPlan(userId, plan, { stripeSubscriptionId: active ? sub.id : null, planRenewsAt: active ? periodEnd(sub) : null });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = await userIdForCustomer(sub.customer, sub.metadata);
        if (userId) await applyPlan(userId, "FREE", { stripeSubscriptionId: null, planRenewsAt: null });
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook]", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
