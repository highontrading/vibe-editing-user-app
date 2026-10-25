/**
 * Built-in recipes. The agent package may extend this list; the seed script
 * upserts them by slug. Keep `prompt` as instructions an editor would give.
 */
export interface RecipeSeed {
  slug: string;
  title: string;
  category: string;
  description: string;
  bring: string;
  sizes: string[];
  prompt: string;
  defaults: Record<string, unknown>;
  tags: string[];
  usesGenerative: boolean;
  isFeatured: boolean;
}

export const BUILTIN_RECIPES: RecipeSeed[] = [
  {
    slug: "talking-head-punchy",
    title: "Punchy Talking Head",
    category: "Talking-head",
    description: "Tight jump cuts, punch-in zooms, bold word captions and a lo-fi bed. The classic creator short.",
    bring: "1–3 clips of you talking to camera, 1–5 minutes total",
    sizes: ["9:16", "1:1"],
    prompt: "Open with the strongest hook line. Remove silences longer than 0.5s and filler words. Jump cut on sentence boundaries, alternate between 100% and 115% punch-ins every 8–12 seconds. Bold Pop captions, 3 words per line, keywords highlighted. Lo-fi music at -18 dB ducked under speech. Whoosh on each punch-in. Kinetic title in the first 2 seconds summarising the topic. End card with the handle.",
    defaults: { captionStyle: "bold-pop", musicMood: "lofi", colorPreset: "clean", targetDurationMs: 45000, platform: "tiktok" },
    tags: ["shorts", "creator", "education"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "vlog-day-in-life",
    title: "Day-in-the-life Vlog",
    category: "Vlog",
    description: "Montage of your day with handwritten captions, warm film grade and an acoustic bed. Beat-timed cuts.",
    bring: "6–20 clips from a day: moments, places, food, short talking bits",
    sizes: ["9:16", "16:9"],
    prompt: "Build a montage that follows the chronological order of the clips. Keep 1.5–3.5 second moments from each clip, prefer motion and faces. Cut on the beat of the music. Warm-film colour preset with light grain. Handwritten captions only for the spoken parts; add a TextCallout for place/time cards. Acoustic music at -14 dB (no ducking needed unless speech). Crossfades between sections, cuts inside sections.",
    defaults: { captionStyle: "handwritten", musicMood: "acoustic", colorPreset: "warm-film", targetDurationMs: 60000, platform: "reels" },
    tags: ["vlog", "lifestyle", "travel"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "product-demo-clean",
    title: "Clean Product Demo",
    category: "Product showcase",
    description: "Screen recording or product footage with pointer highlights, clean captions and a corporate bed.",
    bring: "A screen recording or product clips plus a voice-over or talking clip",
    sizes: ["16:9", "9:16"],
    prompt: "Structure: problem (5s) → solution (bulk) → call to action (3s). Keep narration tight: remove silences over 0.7s. Use PointerHighlight on the area being discussed when the transcript mentions clicking, selecting or a feature name. Clean Minimal captions at the bottom. Corporate music at -20 dB ducked. Chapter cards for each major feature. End card with the product name and URL.",
    defaults: { captionStyle: "clean-minimal", musicMood: "corporate", colorPreset: "clean", targetDurationMs: 60000, platform: "youtube" },
    tags: ["saas", "demo", "launch"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "montage-hype",
    title: "Hype Montage",
    category: "Effect",
    description: "Fast beat-synced cuts, zoom pulses, flash transitions and an energetic track. For reels, sports, events.",
    bring: "8+ action clips, no talking needed",
    sizes: ["9:16", "1:1", "16:9"],
    prompt: "Pick the most dynamic 0.8–2 second moments. Cut strictly on beats, accelerate cut rate towards the end. Zoom pulse effect on every clip, flash transitions on the drop, whip pans between sections. Vibrant colour preset. No captions unless there is speech; add a KineticTitle at the start with the event or theme name. Energetic music at -12 dB, impact SFX on the title.",
    defaults: { captionStyle: "glow", musicMood: "energetic", colorPreset: "vibrant", targetDurationMs: 30000, platform: "reels" },
    tags: ["montage", "sports", "event", "hype"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "explainer-structured",
    title: "Structured Explainer",
    category: "Explainer",
    description: "Numbered chapters, two-line captions, stock b-roll over long explanations, calm cinematic bed.",
    bring: "A talking clip or voice-over explaining something, 2–10 minutes",
    sizes: ["16:9", "9:16"],
    prompt: "Detect the main points in the transcript and insert a ChapterCard (01, 02, 03…) before each. Remove silences over 0.6s and filler words. Insert stock b-roll over any stretch of talking longer than 12 seconds, matched to the subject being discussed. Two-line captions. Cinematic music at -22 dB ducked. Progress bar at the top. Moody colour preset with a subtle vignette.",
    defaults: { captionStyle: "two-line", musicMood: "cinematic", colorPreset: "moody", targetDurationMs: 90000, platform: "youtube" },
    tags: ["education", "explainer", "b-roll"],
    usesGenerative: false,
    isFeatured: true,
  },
];
