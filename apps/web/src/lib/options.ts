/** Shared, client-safe option lists for the home prompt, recipes and settings. */
export const ASPECT_OPTIONS = [
  { value: "auto", label: "Auto", hint: "Detect from footage / platform" },
  { value: "9:16", label: "9:16", hint: "TikTok, Reels, Shorts" },
  { value: "16:9", label: "16:9", hint: "YouTube, X" },
  { value: "1:1", label: "1:1", hint: "LinkedIn, feed" },
  { value: "4:5", label: "4:5", hint: "Instagram feed" },
] as const;
export type AspectOption = (typeof ASPECT_OPTIONS)[number]["value"];

export const LENGTH_OPTIONS = [
  { value: 0, label: "Auto" },
  { value: 15_000, label: "15s" },
  { value: 30_000, label: "30s" },
  { value: 60_000, label: "60s" },
  { value: 180_000, label: "3 min" },
  { value: -1, label: "Full" },
] as const;

export const STYLE_CHIPS = [
  { id: "montage", label: "Montage", verb: "montage", recipeSlug: "montage-hype", platform: "reels", aspect: "9:16" },
  { id: "vlog", label: "Vlog", verb: "vlog", recipeSlug: "vlog-day-in-life", platform: "reels", aspect: "9:16" },
  { id: "talking-head", label: "Talking-head", verb: "talking-head", recipeSlug: "talking-head-punchy", platform: "tiktok", aspect: "9:16" },
  { id: "explainer", label: "Explainer", verb: "explainer", recipeSlug: "explainer-structured", platform: "youtube", aspect: "16:9" },
  { id: "product-demo", label: "Product demo", verb: "product demo", recipeSlug: "product-demo-clean", platform: "youtube", aspect: "16:9" },
  { id: "ad", label: "Ad / Promo", verb: "ad", recipeSlug: null, platform: "reels", aspect: "9:16" },
  { id: "launch", label: "Launch video", verb: "launch video", recipeSlug: null, platform: "x", aspect: "16:9" },
  { id: "podcast", label: "Podcast clip", verb: "podcast clip", recipeSlug: null, platform: "shorts", aspect: "9:16" },
  { id: "tutorial", label: "Tutorial", verb: "tutorial", recipeSlug: null, platform: "youtube", aspect: "16:9" },
] as const;

export const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok", aspect: "9:16" },
  { value: "reels", label: "Instagram Reels", aspect: "9:16" },
  { value: "shorts", label: "YouTube Shorts", aspect: "9:16" },
  { value: "youtube", label: "YouTube", aspect: "16:9" },
  { value: "linkedin", label: "LinkedIn", aspect: "1:1" },
  { value: "x", label: "X", aspect: "16:9" },
  { value: "custom", label: "Custom", aspect: "16:9" },
] as const;

export const RECIPE_CATEGORIES = ["UGC", "Clipping", "Vlog", "Effect", "Viral trends", "Travel montage", "Product showcase", "Aftermovie", "Explainer", "Talking-head", "Launch video", "Podcast"] as const;

export const BRAND_FONTS = ["Inter", "Instrument Serif", "Montserrat", "Poppins", "Playfair Display", "Bebas Neue", "Oswald", "Roboto", "Space Grotesk", "DM Sans", "Lora", "Archivo Black", "JetBrains Mono"] as const;

export const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "hi", label: "Hindi" },
  { value: "ja", label: "Japanese" },
] as const;

/** Detect a platform mentioned in a brief ("for TikTok" -> tiktok). */
export function detectPlatform(brief: string): { platform: string; aspect: string } | null {
  const b = brief.toLowerCase();
  if (/tiktok/.test(b)) return { platform: "tiktok", aspect: "9:16" };
  if (/reels?\b|instagram/.test(b)) return { platform: "reels", aspect: "9:16" };
  if (/shorts?\b/.test(b)) return { platform: "shorts", aspect: "9:16" };
  if (/youtube/.test(b)) return { platform: "youtube", aspect: "16:9" };
  if (/linkedin/.test(b)) return { platform: "linkedin", aspect: "1:1" };
  if (/\btwitter\b|\bx\.com\b|\bon x\b/.test(b)) return { platform: "x", aspect: "16:9" };
  return null;
}

export const PROJECT_STATUS_META: Record<string, { label: string; tone: "neutral" | "accent" | "success" | "danger" | "info"; busy?: boolean }> = {
  DRAFTING: { label: "Draft", tone: "neutral" },
  ANALYZING: { label: "Analysing", tone: "info", busy: true },
  PLANNING: { label: "Planning", tone: "info", busy: true },
  PLAN_READY: { label: "Plan ready", tone: "accent" },
  BUILDING: { label: "Building", tone: "info", busy: true },
  READY: { label: "Ready", tone: "success" },
  EXPORTING: { label: "Exporting", tone: "info", busy: true },
  FAILED: { label: "Failed", tone: "danger" },
};

export const ASSET_STATUS_META: Record<string, { label: string; tone: "neutral" | "accent" | "success" | "danger" | "info"; busy?: boolean }> = {
  UPLOADING: { label: "Uploading", tone: "info", busy: true },
  UPLOADED: { label: "Queued", tone: "neutral", busy: true },
  PROCESSING: { label: "Processing", tone: "info", busy: true },
  READY: { label: "Ready", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};

/** Deterministic gradient for cards without a preview image. */
export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 40 + (h % 60)) % 360;
  const c = (a + 180) % 360;
  return `linear-gradient(135deg, hsl(${a} 55% 22%) 0%, hsl(${b} 60% 30%) 55%, hsl(${c} 50% 18%) 100%)`;
}
