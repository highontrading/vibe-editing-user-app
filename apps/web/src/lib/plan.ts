/**
 * Plan gating helpers. Server-safe (imports @vibe/core). Pass the results to
 * client components as props rather than importing this file from the client.
 */
import { PLAN_LIMITS, type PlanId } from "@vibe/core";

export type PlanLimits = (typeof PLAN_LIMITS)[PlanId];

export function asPlanId(plan: string | null | undefined): PlanId {
  return (plan && plan in PLAN_LIMITS ? plan : "FREE") as PlanId;
}

export function limitsFor(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[asPlanId(plan)];
}

export function canExport4k(plan: string | null | undefined) {
  return limitsFor(plan).maxResolution === "4k";
}
export function canExport1080p(plan: string | null | undefined) {
  const r = limitsFor(plan).maxResolution;
  return r === "1080p" || r === "4k";
}
export function maxResolution(plan: string | null | undefined) {
  return limitsFor(plan).maxResolution;
}
export function watermark(plan: string | null | undefined) {
  return limitsFor(plan).watermark;
}
export function projectLimit(plan: string | null | undefined) {
  return limitsFor(plan).projects;
}
export function canUseGenerative(plan: string | null | undefined) {
  return limitsFor(plan).generative;
}
export function storageLimitBytes(plan: string | null | undefined) {
  return limitsFor(plan).storageGb * 1024 ** 3;
}

export const CYCLE_DAYS = 30;

export function usageSummary(user: { plan: string; minutesUsed: number; minutesQuota: number; cycleStartedAt: Date | string }) {
  const started = new Date(user.cycleStartedAt);
  const resetsAt = new Date(started.getTime() + CYCLE_DAYS * 86400_000);
  const quota = user.minutesQuota || limitsFor(user.plan).minutes;
  const used = Math.max(0, user.minutesUsed);
  return { used, quota, pct: Math.min(100, Math.round((used / Math.max(1, quota)) * 100)), resetsAt, remaining: Math.max(0, quota - used) };
}

/** Serialisable plan catalogue for client components (pricing cards). */
export function planCatalog() {
  return (Object.keys(PLAN_LIMITS) as PlanId[]).map((id) => ({ id, ...PLAN_LIMITS[id] }));
}
export type PlanCatalogEntry = ReturnType<typeof planCatalog>[number];
