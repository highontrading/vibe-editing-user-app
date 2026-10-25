export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function titleFromBrief(brief: string | null | undefined, fallback = "Untitled project"): string {
  if (!brief) return fallback;
  const clean = brief.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  const words = clean.split(" ").slice(0, 7).join(" ");
  return words.length < clean.length ? `${words}…` : words;
}

export function minutesForBytesEstimate(durationMs: number) {
  return Math.max(0.1, durationMs / 60000);
}

export const PLAN_LIMITS = {
  FREE: { minutes: 10, maxResolution: "720p", watermark: true, projects: 3, storageGb: 2, generative: false, label: "Free", price: 0 },
  CREATOR: { minutes: 120, maxResolution: "1080p", watermark: false, projects: 100, storageGb: 20, generative: false, label: "Creator", price: 19 },
  PRO: { minutes: 400, maxResolution: "4k", watermark: false, projects: 1000, storageGb: 200, generative: true, label: "Pro", price: 49 },
  STUDIO: { minutes: 1500, maxResolution: "4k", watermark: false, projects: 100000, storageGb: 1000, generative: true, label: "Studio", price: 149 },
} as const;
export type PlanId = keyof typeof PLAN_LIMITS;
