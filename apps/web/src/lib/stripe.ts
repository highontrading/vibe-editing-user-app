import Stripe from "stripe";
import { env, PLAN_LIMITS, type PlanId } from "@vibe/core";

let client: Stripe | null = null;

/** Stripe client or null when STRIPE_SECRET_KEY is not configured. */
export function getStripe(): Stripe | null {
  const cfg = env.stripe;
  if (!cfg) return null;
  if (!client) client = new Stripe(cfg.secretKey);
  return client;
}

export function stripeConfigured() {
  return !!env.stripe;
}

export function priceForPlan(plan: PlanId): string | null {
  const cfg = env.stripe;
  if (!cfg || plan === "FREE") return null;
  return cfg.prices[plan] || null;
}

export function planForPrice(priceId: string | null | undefined): PlanId | null {
  const cfg = env.stripe;
  if (!cfg || !priceId) return null;
  for (const [plan, id] of Object.entries(cfg.prices)) if (id && id === priceId) return plan as PlanId;
  return null;
}

export function quotaForPlan(plan: PlanId) {
  return PLAN_LIMITS[plan].minutes;
}
