/**
 * Built-in recipes. The agent package reads `prompt` (into the cached system
 * prompt) and `defaults` (builder parameters). The seed script upserts them by slug.
 *
 * Defaults the builder understands (all optional):
 *   captionStyle, musicMood, colorPreset, targetDurationMs, platform,
 *   transitions (cut|crossfade|whip|zoom|slide|flash|glitch|dip-to-black),
 *   silenceThresholdMs, removeFillers, hookFirst, punchIns, punchInEvery, punchInScale,
 *   broll (bool), brollEvery (ms), progressBar, musicGainDb, sfxOnCuts,
 *   beatSync, clipMinMs, clipMaxMs, zoomPulse, flashOnSection
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

/** Ordered list used by the gallery filter. */
export const RECIPE_CATEGORIES = [
  "Talking-head",
  "UGC",
  "Clipping",
  "Vlog",
  "Travel montage",
  "Aftermovie",
  "Effect",
  "Viral trends",
  "Product showcase",
  "Launch video",
  "Explainer",
  "Podcast",
] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const BUILTIN_RECIPES: RecipeSeed[] = [
  /* ---------------------------- Talking-head ---------------------------- */
  {
    slug: "talking-head-punchy",
    title: "Punchy Talking Head",
    category: "Talking-head",
    description: "Tight jump cuts, punch-in zooms, bold word captions and a lo-fi bed. The classic creator short.",
    bring: "1–3 clips of you talking to camera, 1–5 minutes total",
    sizes: ["9:16", "1:1"],
    prompt:
      "Open with the strongest hook line even if it was said later; never open on a greeting. Remove pauses longer than 0.5 s and every filler word, keeping about 120 ms of breathing room so cuts feel human. Jump cut on sentence boundaries only. Alternate full frame and a 112% punch-in every 8–12 s, switching on a cut. Bold Pop captions, word by word, 3 words per group, numbers and the carrying verb highlighted in yellow. Lo-fi bed at -18 dB ducked under speech. One whoosh per punch-in, an impact under the title, nothing else. Kinetic title in the first 2.5 s summarising the topic in 2–5 words; end card with the handle in the last 3 s. Clean colour.",
    defaults: { captionStyle: "bold-pop", musicMood: "lofi", colorPreset: "clean", targetDurationMs: 45000, platform: "tiktok", silenceThresholdMs: 500, removeFillers: true, hookFirst: true, punchIns: true, punchInEvery: 10000, punchInScale: 1.12, broll: false, musicGainDb: -18, sfxOnCuts: true, transitions: "cut" },
    tags: ["shorts", "creator", "education"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "talking-head-calm",
    title: "Calm Expert",
    category: "Talking-head",
    description: "Slower, premium talking-head for LinkedIn and YouTube: gentle cuts, clean captions, no hype.",
    bring: "One talking clip, 1–8 minutes; optional slides or screenshots",
    sizes: ["1:1", "16:9", "4:5"],
    prompt:
      "This is a thoughtful expert, not a hype creator. Open on the clearest one-sentence thesis. Remove pauses over 0.8 s but keep natural breaths and keep most filler words unless they stack. Cut only on sentence boundaries; no punch-ins unless a cut lands mid-shot, then a subtle 106%. Clean Minimal captions at the bottom, sentence case, 6 words per line, one highlight per line. Corporate or acoustic bed at -22 dB, ducked. No SFX. A lower third with name and title at 2 s; no end card unless the brief asks; a progress bar on anything over 60 s. Clean colour, no grain.",
    defaults: { captionStyle: "clean-minimal", musicMood: "acoustic", colorPreset: "clean", targetDurationMs: 90000, platform: "linkedin", silenceThresholdMs: 800, removeFillers: false, hookFirst: true, punchIns: false, broll: false, musicGainDb: -22, sfxOnCuts: false, progressBar: true, transitions: "cut" },
    tags: ["linkedin", "b2b", "thought-leadership"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* -------------------------------- UGC -------------------------------- */
  {
    slug: "ugc-testimonial",
    title: "UGC Testimonial Ad",
    category: "UGC",
    description: "Selfie-style product testimonial: hook, problem, product, proof, CTA. Boxed captions, emoji pops, upbeat bed.",
    bring: "A selfie video talking about the product (30 s–3 min) and 2–6 product shots or screenshots",
    sizes: ["9:16", "4:5"],
    prompt:
      "Structure as a paid-social ad: hook (0–2 s: the problem or a bold result), context (what life was like), the product moment, proof (numbers, before/after), CTA. Reorder the transcript if needed to follow this arc. Remove pauses over 0.4 s and fillers; this must feel fast and native. Boxed captions, 4 words per line, emoji on product and emotion words. Insert the product shots as b-roll overlays for 2–3 s each when the product is named. Upbeat bed at -16 dB ducked. Pop SFX when a product shot lands, maximum four. Text callout with the key stat when one is spoken. End card with the offer and handle. Vibrant colour.",
    defaults: { captionStyle: "boxed", musicMood: "upbeat", colorPreset: "vibrant", targetDurationMs: 30000, platform: "reels", silenceThresholdMs: 400, removeFillers: true, hookFirst: true, punchIns: true, punchInEvery: 6000, punchInScale: 1.1, broll: true, brollEvery: 8000, musicGainDb: -16, sfxOnCuts: true, transitions: "cut" },
    tags: ["ads", "ugc", "ecommerce", "paid-social"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "ugc-unboxing",
    title: "Unboxing & First Impressions",
    category: "UGC",
    description: "Unboxing with reaction beats, pointer highlights on details and emoji captions.",
    bring: "An unboxing clip (2–10 min) plus optional close-ups",
    sizes: ["9:16"],
    prompt:
      "Open on the reveal or the strongest reaction, then cut back to the box opening. Cut aggressively: remove pauses over 0.4 s, fillers, and any stretch over 6 s without a new object or statement. Speed up unwrapping stretches to 2x with a speed ramp into the reveal. Emoji Pop captions, 3 words per group. Pointer highlight when a specific detail is named ('this button', 'the texture'). Funky bed at -16 dB ducked, camera-shutter SFX on the first reveal, pops on emoji. Title with the product name at 0:00, subscribe bubble mid-way, end card.",
    defaults: { captionStyle: "emoji-pop", musicMood: "funky", colorPreset: "vibrant", targetDurationMs: 60000, platform: "tiktok", silenceThresholdMs: 400, removeFillers: true, hookFirst: true, punchIns: true, punchInEvery: 7000, punchInScale: 1.12, broll: false, musicGainDb: -16, sfxOnCuts: true, transitions: "cut" },
    tags: ["unboxing", "review", "ugc"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* ------------------------------ Clipping ------------------------------ */
  {
    slug: "clipping-viral-clip",
    title: "Viral Clip from Long-form",
    category: "Clipping",
    description: "Pull the single best moment from a long talk or stream: hook title, two-line captions, progress bar.",
    bring: "A long recording (10–120 min): podcast, stream, talk or interview",
    sizes: ["9:16", "1:1"],
    prompt:
      "Find the single most self-contained, surprising or emotional 30–60 s stretch: a claim plus its payoff, a story with a punchline, or a hot take. It must make sense without context; add a 3–6 word kinetic title that frames it as a question or claim. Open on the hook sentence, then play the stretch in order. Remove pauses over 0.6 s and fillers; keep laughter and reactions. Two-line captions with the current word brightened, 5 words per line. Subtle 108% punch-in on speaker changes. No music unless the brief asks; if asked, dark or lo-fi at -22 dB. Progress bar at the top. End card with the episode or channel name.",
    defaults: { captionStyle: "two-line", colorPreset: "clean", targetDurationMs: 45000, platform: "shorts", silenceThresholdMs: 600, removeFillers: true, hookFirst: true, punchIns: true, punchInEvery: 12000, punchInScale: 1.08, broll: false, progressBar: true, musicGainDb: -22, sfxOnCuts: false, transitions: "cut" },
    tags: ["clipping", "podcast", "stream", "repurpose"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "clipping-quote-card",
    title: "Quote Clip",
    category: "Clipping",
    description: "A 10–20 s single-quote clip with karaoke captions and a dip-to-black ending. Perfect for X and LinkedIn.",
    bring: "Any talking recording; tell us the quote or let us pick",
    sizes: ["1:1", "16:9", "9:16"],
    prompt:
      "Isolate one quotable sentence or two (8–20 s). Start exactly on the first word with 150 ms of lead-in, end 300 ms after the last word, then dip to black. Karaoke captions, line mode, the spoken word filling with colour; sentence case. No punch-ins, no SFX. Optional emotional piano at -24 dB fading in over 1 s and out over 1.5 s. Lower third with the speaker's name for the first 4 s. Moody colour with a light vignette.",
    defaults: { captionStyle: "karaoke", musicMood: "emotional", colorPreset: "moody", targetDurationMs: 15000, platform: "x", silenceThresholdMs: 700, removeFillers: false, hookFirst: false, punchIns: false, broll: false, musicGainDb: -24, sfxOnCuts: false, transitions: "dip-to-black" },
    tags: ["quote", "clipping", "x", "linkedin"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* -------------------------------- Vlog -------------------------------- */
  {
    slug: "vlog-day-in-life",
    title: "Day-in-the-life Vlog",
    category: "Vlog",
    description: "Montage of your day with handwritten captions, warm film grade and an acoustic bed. Beat-timed cuts.",
    bring: "6–20 clips from a day: moments, places, food, short talking bits",
    sizes: ["9:16", "16:9"],
    prompt:
      "Follow the chronological order of the clips. Keep 1.5–3.5 s moments from each, preferring motion, faces and food; skip shaky or dark stretches. Cut on the beat of the music; crossfade between locations, hard cuts inside a location. Talking bits are kept whole with pauses over 0.8 s removed and fillers left in: this should feel diary-like. Handwritten captions only for the spoken parts, 5 words per line. Text callouts for place or time cards when the clip changes location. Acoustic bed at -14 dB when nobody is talking, ducked to -20 dB under speech. No SFX except one soft whoosh per location change. Warm film with light grain. No title unless asked; end card optional.",
    defaults: { captionStyle: "handwritten", musicMood: "acoustic", colorPreset: "warm-film", targetDurationMs: 60000, platform: "reels", silenceThresholdMs: 800, removeFillers: false, hookFirst: false, punchIns: false, broll: false, musicGainDb: -14, sfxOnCuts: false, transitions: "crossfade", beatSync: true, clipMinMs: 1500, clipMaxMs: 3500 },
    tags: ["vlog", "lifestyle", "travel"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "vlog-storytime",
    title: "Storytime Vlog",
    category: "Vlog",
    description: "You tell a story to camera; we add b-roll from your clips, outline captions and chill music.",
    bring: "A talking clip telling the story plus 3–15 supporting clips or photos",
    sizes: ["9:16", "16:9"],
    prompt:
      "The talking clip is the spine. Open on the most intriguing line of the story ('and that's when I realised…'), then tell it in order. Remove pauses over 0.6 s and stacked fillers; keep laughs and pauses before punchlines. Cover every talking stretch longer than 8 s with 3–4 s of the user's own supporting clips (b-roll) matched to what is being described; use stock only when the user has nothing that fits. Outline captions, 4 words per group. Chill bed at -18 dB ducked. Soft whoosh on b-roll entrances only. Title with the story's premise at 0:00, end card with the handle. Warm film.",
    defaults: { captionStyle: "outline", musicMood: "chill", colorPreset: "warm-film", targetDurationMs: 75000, platform: "shorts", silenceThresholdMs: 600, removeFillers: true, hookFirst: true, punchIns: true, punchInEvery: 12000, punchInScale: 1.08, broll: true, brollEvery: 8000, musicGainDb: -18, sfxOnCuts: false, transitions: "crossfade" },
    tags: ["vlog", "story", "narrative"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* --------------------------- Travel montage --------------------------- */
  {
    slug: "travel-cinematic",
    title: "Cinematic Travel Montage",
    category: "Travel montage",
    description: "Slow, wide, teal-and-orange travel film with speed ramps and a cinematic score.",
    bring: "8–30 travel clips: landscapes, streets, people, drone shots",
    sizes: ["16:9", "9:16"],
    prompt:
      "Build in three acts: arrival (wide establishing shots, 2.5–3 s each), immersion (people, food, detail shots on the beat, 1.5–2 s), and a finale (the single best shot held for 4 s with a slow zoom pulse). Order by time of day where visible: morning light first, golden hour, night last. Cut on the beat; speed ramp into drone shots; crossfade only between acts. Teal and orange grade with a light vignette. Cinematic score at -10 dB (no speech). No captions; one kinetic title with the place name at 0:00 and a text callout for each new city. Riser SFX into the finale, impact on the title, nothing else.",
    defaults: { captionStyle: "glow", musicMood: "cinematic", colorPreset: "teal-orange", targetDurationMs: 45000, platform: "youtube", hookFirst: false, punchIns: false, broll: false, musicGainDb: -10, sfxOnCuts: false, transitions: "crossfade", beatSync: true, clipMinMs: 1500, clipMaxMs: 3000, zoomPulse: true, flashOnSection: false },
    tags: ["travel", "cinematic", "montage", "drone"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "travel-fast-reel",
    title: "Fast Travel Reel",
    category: "Travel montage",
    description: "Trendy 15–20 s reel: one clip per beat, whip pans, flash on the drop, vibrant colour.",
    bring: "10+ short clips from a trip",
    sizes: ["9:16"],
    prompt:
      "Fifteen to twenty seconds, one shot per beat (0.8–1.2 s), the most dynamic frame of each clip. Open on the best shot for 1.5 s with the destination as a kinetic title. Whip pan every fourth cut, white flash on the drop, zoom pulse on every clip. Vibrant grade. Energetic track at -10 dB. No captions. End card with the handle on the last beat.",
    defaults: { captionStyle: "glow", musicMood: "energetic", colorPreset: "vibrant", targetDurationMs: 18000, platform: "reels", hookFirst: false, punchIns: false, broll: false, musicGainDb: -10, sfxOnCuts: false, transitions: "whip", beatSync: true, clipMinMs: 800, clipMaxMs: 1500, zoomPulse: true, flashOnSection: true },
    tags: ["travel", "reel", "trend"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* ------------------------------ Aftermovie ---------------------------- */
  {
    slug: "aftermovie-event",
    title: "Event Aftermovie",
    category: "Aftermovie",
    description: "Energy-arc aftermovie for conferences, parties and sports days: build-up, peak, afterglow.",
    bring: "15–60 clips from the event, including crowd, stage, details and 1–3 short soundbites",
    sizes: ["16:9", "9:16", "1:1"],
    prompt:
      "Three-part energy arc: build-up (venue, arrivals, details, 2–2.5 s cuts, crossfades), peak (crowd, stage, reactions, 0.8–1.5 s cuts strictly on the beat, flash on the drop), afterglow (smiles, goodbyes, a wide night shot, 3 s cuts, slow crossfades). Open with the single most energetic 1.5 s shot and the event name as a kinetic title with an impact. If there are soundbites, place one at the start of the peak and one at the end over music ducked to -18 dB; Glow captions for those lines only. Energetic track at -10 dB leading. Logo bug in a corner if a logo is provided. End card with the event name and date. Vibrant grade.",
    defaults: { captionStyle: "glow", musicMood: "energetic", colorPreset: "vibrant", targetDurationMs: 60000, platform: "youtube", hookFirst: true, punchIns: false, broll: false, musicGainDb: -10, sfxOnCuts: false, transitions: "crossfade", beatSync: true, clipMinMs: 1000, clipMaxMs: 2500, zoomPulse: true, flashOnSection: true },
    tags: ["event", "aftermovie", "conference", "party"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "aftermovie-wedding",
    title: "Wedding Highlight",
    category: "Aftermovie",
    description: "Emotional highlight film: vows and speeches as the spine, moments as b-roll, warm film grade.",
    bring: "Ceremony and speech clips plus moments (prep, first look, party)",
    sizes: ["16:9", "9:16"],
    prompt:
      "The spoken vows or speeches are the spine; choose the most emotional 2–4 lines. Open on a quiet wide shot with the first line over it. Cover speech with the day's moments in order (prep, first look, ceremony, party) for 3–4 s each with slow crossfades. Keep pauses: they carry emotion; only remove pauses over 1.5 s. No punch-ins, no SFX. Emotional piano at -16 dB, ducked to -24 dB under speech, 2 s fades. Handwritten captions in line mode for the spoken lines only. Warm film with soft grain. Title with the couple's names and date at 0:00, dip to black at the end.",
    defaults: { captionStyle: "handwritten", musicMood: "emotional", colorPreset: "warm-film", targetDurationMs: 120000, platform: "youtube", silenceThresholdMs: 1500, removeFillers: false, hookFirst: true, punchIns: false, broll: true, brollEvery: 6000, musicGainDb: -16, sfxOnCuts: false, transitions: "crossfade" },
    tags: ["wedding", "emotional", "highlight"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* -------------------------------- Effect ------------------------------ */
  {
    slug: "montage-hype",
    title: "Hype Montage",
    category: "Effect",
    description: "Fast beat-synced cuts, zoom pulses, flash transitions and an energetic track. For reels, sports, events.",
    bring: "8+ action clips, no talking needed",
    sizes: ["9:16", "1:1", "16:9"],
    prompt:
      "Pick the most dynamic 0.8–2 s moments. Cut strictly on beats, accelerate the cut rate towards the end. Zoom pulse on every clip, flash transitions on the drop, whip pans between sections. Vibrant colour. No captions unless there is speech; add a kinetic title at the start with the event or theme name and an impact under it. Energetic music at -12 dB.",
    defaults: { captionStyle: "glow", musicMood: "energetic", colorPreset: "vibrant", targetDurationMs: 30000, platform: "reels", hookFirst: false, punchIns: false, broll: false, musicGainDb: -12, sfxOnCuts: false, transitions: "whip", beatSync: true, clipMinMs: 800, clipMaxMs: 2000, zoomPulse: true, flashOnSection: true },
    tags: ["montage", "sports", "event", "hype"],
    usesGenerative: false,
    isFeatured: false,
  },
  {
    slug: "effect-glitch-edit",
    title: "Glitch Edit",
    category: "Effect",
    description: "Dark, glitchy edit with RGB-split transitions, shake on hits and neon glow captions.",
    bring: "Any clips with attitude: gaming, fashion, cars, dance",
    sizes: ["9:16", "1:1"],
    prompt:
      "Cut on the beat with 1–2 s clips. Glitch transition every second cut, camera shake (0.4) for 300 ms on the drop, zoom pulse throughout. Moody grade with heavy vignette, slight grain. Dark or energetic track at -10 dB. Glow captions only if there is speech, 3 words per group. Glitch SFX on each glitch transition, capped to one per 3 s. Title in typewriter style at 0:00.",
    defaults: { captionStyle: "glow", musicMood: "dark", colorPreset: "moody", targetDurationMs: 20000, platform: "tiktok", hookFirst: false, punchIns: false, broll: false, musicGainDb: -10, sfxOnCuts: true, transitions: "glitch", beatSync: true, clipMinMs: 1000, clipMaxMs: 2000, zoomPulse: true, flashOnSection: false },
    tags: ["glitch", "effect", "gaming", "fashion"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* ----------------------------- Viral trends --------------------------- */
  {
    slug: "trend-listicle",
    title: "Listicle Countdown",
    category: "Viral trends",
    description: "'5 things…' format: countdown numbers, chapter cards, ding on each item, Hormozi captions.",
    bring: "A talking clip listing items, or several clips (one per item)",
    sizes: ["9:16"],
    prompt:
      "Detect the list items in the transcript ('number one', 'first', 'next'). Open with the promise line ('5 things nobody tells you about…') as a kinetic title and the spoken hook. Before each item insert a chapter card (01, 02…) for 1.2 s with a ding SFX. Remove pauses over 0.5 s and fillers. Hormozi captions, uppercase, 3 words per group. 112% punch-in on each item's key sentence. Upbeat bed at -18 dB ducked. Progress bar at the top. End card asking which item they'd add.",
    defaults: { captionStyle: "hormozi", musicMood: "upbeat", colorPreset: "clean", targetDurationMs: 50000, platform: "tiktok", silenceThresholdMs: 500, removeFillers: true, hookFirst: true, punchIns: true, punchInEvery: 9000, punchInScale: 1.12, broll: false, progressBar: true, musicGainDb: -18, sfxOnCuts: true, transitions: "cut" },
    tags: ["listicle", "trend", "education"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "trend-pov-text",
    title: "POV Text Trend",
    category: "Viral trends",
    description: "Short clip with a big on-screen 'POV:' caption, trending-style music and a single punch-in.",
    bring: "One clip, 5–20 s, with or without speech; the POV line in the brief",
    sizes: ["9:16"],
    prompt:
      "Hold the clip almost untouched: trim to the best 7–15 s, start on motion. Place a Text Callout at the top for the whole duration with the POV line from the brief (max 12 words), size lg. One slow punch-in from 100% to 110% across the clip (speed ramp not needed). Energetic or funky track at -8 dB; mute footage audio unless there is speech, then duck music to -18 dB and add Bold Pop captions. No title, no end card, no SFX. Vibrant grade.",
    defaults: { captionStyle: "bold-pop", musicMood: "funky", colorPreset: "vibrant", targetDurationMs: 12000, platform: "tiktok", silenceThresholdMs: 900, removeFillers: false, hookFirst: false, punchIns: true, punchInEvery: 4000, punchInScale: 1.1, broll: false, musicGainDb: -8, sfxOnCuts: false, transitions: "cut" },
    tags: ["pov", "trend", "meme"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* --------------------------- Product showcase ------------------------- */
  {
    slug: "product-demo-clean",
    title: "Clean Product Demo",
    category: "Product showcase",
    description: "Screen recording or product footage with pointer highlights, clean captions and a corporate bed.",
    bring: "A screen recording or product clips plus a voice-over or talking clip",
    sizes: ["16:9", "9:16"],
    prompt:
      "Structure: problem (5 s) → solution (bulk) → call to action (3 s). Keep narration tight: remove silences over 0.7 s, keep fillers only if removing them clips words. Use PointerHighlight on the area being discussed whenever the transcript mentions clicking, selecting or a feature name; never more than one highlight at a time. Clean Minimal captions at the bottom, 6 words per line. Corporate bed at -20 dB ducked. Chapter cards for each major feature. No punch-ins on UI (text gets soft); cut to a closer crop instead. End card with the product name and URL. Clean colour.",
    defaults: { captionStyle: "clean-minimal", musicMood: "corporate", colorPreset: "clean", targetDurationMs: 60000, platform: "youtube", silenceThresholdMs: 700, removeFillers: true, hookFirst: true, punchIns: false, broll: false, musicGainDb: -20, sfxOnCuts: false, transitions: "cut" },
    tags: ["saas", "demo", "product"],
    usesGenerative: false,
    isFeatured: false,
  },
  {
    slug: "product-showcase-cinematic",
    title: "Cinematic Product Showcase",
    category: "Product showcase",
    description: "Hero product video: slow reveals, macro details, light leaks, music-led with a few bold text cards.",
    bring: "6–15 product clips: wide, detail, in-use; optional logo",
    sizes: ["16:9", "9:16", "1:1"],
    prompt:
      "Music-led, no speech expected. Open on a 3 s dark detail shot with a slow zoom pulse and the product name as a kinetic title (rise style). Alternate macro details (1.5–2 s) and in-use shots (2.5–3 s) on the beat; crossfade between details, cut into in-use shots. Light leak on the two reveal moments. Three text callouts maximum with the key benefits from the brief, each 2 s, placed on the quiet beats. Cinematic or chill track at -10 dB, riser into the final reveal, impact on the title. Moody or teal-orange grade with a soft vignette. End card with the logo (ImageOverlay or LogoBug) and URL.",
    defaults: { captionStyle: "clean-minimal", musicMood: "cinematic", colorPreset: "teal-orange", targetDurationMs: 30000, platform: "youtube", hookFirst: false, punchIns: false, broll: false, musicGainDb: -10, sfxOnCuts: false, transitions: "crossfade", beatSync: true, clipMinMs: 1500, clipMaxMs: 3000, zoomPulse: true, flashOnSection: false },
    tags: ["product", "hero", "ecommerce", "brand"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* ----------------------------- Launch video --------------------------- */
  {
    slug: "launch-announcement",
    title: "Launch Announcement",
    category: "Launch video",
    description: "'We just launched X': a founder to camera plus product shots, countdown opener, bold title, CTA.",
    bring: "A founder clip announcing the launch (30 s–3 min) and 3–10 product clips or screenshots",
    sizes: ["9:16", "16:9", "1:1"],
    prompt:
      "Open with a 3-2-1 countdown (CountdownTimer, 2 s) under a riser, straight into the one-sentence announcement from the transcript as the hook, with the product name as a kinetic title (slam) and an impact. Keep the founder tight: pauses over 0.5 s and fillers removed, 110% punch-ins every 8 s. Every time a feature is named, overlay the matching product clip or screenshot for 3 s (user's assets first, stock never). Hormozi captions for hype launches, Clean Minimal for B2B; pick from the brief. Upbeat or corporate bed at -16 dB ducked. Subscribe/follow bubble at the midpoint. End card with the URL, the launch date if given, and the handle. Vibrant for consumer, clean for B2B.",
    defaults: { captionStyle: "hormozi", musicMood: "upbeat", colorPreset: "vibrant", targetDurationMs: 40000, platform: "reels", silenceThresholdMs: 500, removeFillers: true, hookFirst: true, punchIns: true, punchInEvery: 8000, punchInScale: 1.1, broll: true, brollEvery: 9000, musicGainDb: -16, sfxOnCuts: true, transitions: "cut" },
    tags: ["launch", "startup", "announcement", "product-hunt"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* ------------------------------- Explainer ---------------------------- */
  {
    slug: "explainer-structured",
    title: "Structured Explainer",
    category: "Explainer",
    description: "Numbered chapters, two-line captions, stock b-roll over long explanations, calm cinematic bed.",
    bring: "A talking clip or voice-over explaining something, 2–10 minutes",
    sizes: ["16:9", "9:16"],
    prompt:
      "Detect the main points in the transcript and insert a ChapterCard (01, 02, 03…) before each. Open on the question the video answers, phrased as a kinetic title, with the spoken hook. Remove silences over 0.6 s and filler words. Insert stock b-roll over any stretch of talking longer than 12 s, matched to the nouns being said, 3.5 s each, never over the hook. Two-line captions, 5 words per line. Cinematic bed at -22 dB ducked. Progress bar at the top. Moody colour preset with a subtle vignette. End card with 'Watch next' and the handle.",
    defaults: { captionStyle: "two-line", musicMood: "cinematic", colorPreset: "moody", targetDurationMs: 90000, platform: "youtube", silenceThresholdMs: 600, removeFillers: true, hookFirst: true, punchIns: true, punchInEvery: 15000, punchInScale: 1.08, broll: true, brollEvery: 12000, progressBar: true, musicGainDb: -22, sfxOnCuts: false, transitions: "cut" },
    tags: ["education", "explainer", "b-roll"],
    usesGenerative: false,
    isFeatured: true,
  },
  {
    slug: "explainer-tutorial-screen",
    title: "Screen Tutorial",
    category: "Explainer",
    description: "Step-by-step screen recording: steps as chapter cards, pointer highlights, typewriter captions.",
    bring: "A screen recording with narration (3–20 min)",
    sizes: ["16:9"],
    prompt:
      "Turn the narration into numbered steps ('first', 'then', 'next', 'finally'); insert a ChapterCard before each step with the step as a 3–6 word title. Remove silences over 0.8 s, keep a 200 ms breath; speed waiting or loading stretches to 3x with a speed ramp. Pointer highlight at the described location when a click or field is mentioned. Typewriter captions at the bottom, 6 words per line. Corporate or lo-fi bed at -24 dB ducked; click SFX on highlights only. Progress bar. No punch-ins on UI. Clean colour.",
    defaults: { captionStyle: "typewriter", musicMood: "lofi", colorPreset: "clean", targetDurationMs: 180000, platform: "youtube", silenceThresholdMs: 800, removeFillers: true, hookFirst: false, punchIns: false, broll: false, progressBar: true, musicGainDb: -24, sfxOnCuts: true, transitions: "cut" },
    tags: ["tutorial", "screen", "how-to"],
    usesGenerative: false,
    isFeatured: false,
  },
  /* -------------------------------- Podcast ----------------------------- */
  {
    slug: "podcast-clip",
    title: "Podcast Clip",
    category: "Podcast",
    description: "Two-speaker clip with speaker-aware captions, lower thirds, and a subtle punch-in on speaker changes.",
    bring: "A podcast recording (audio + one or two camera angles), 20–120 min",
    sizes: ["9:16", "1:1", "16:9"],
    prompt:
      "Pick the strongest 45–75 s exchange: a question followed by a surprising answer, or a story with a payoff. Open on the hook line, then play in order. Cut on speaker changes and sentence boundaries; alternate 100%/108% framing per speaker so it feels like a two-camera shoot. Remove pauses over 0.7 s, keep fillers and laughs. Two-line captions with speaker colours, 5 words per line. Lower third for each speaker the first time they speak. No music unless asked; if asked, lo-fi at -24 dB. Progress bar. End card with the episode title and where to listen. Clean colour.",
    defaults: { captionStyle: "two-line", colorPreset: "clean", targetDurationMs: 60000, platform: "shorts", silenceThresholdMs: 700, removeFillers: false, hookFirst: true, punchIns: true, punchInEvery: 8000, punchInScale: 1.08, broll: false, progressBar: true, musicGainDb: -24, sfxOnCuts: false, transitions: "cut" },
    tags: ["podcast", "interview", "clip"],
    usesGenerative: false,
    isFeatured: false,
  },
  {
    slug: "podcast-audiogram",
    title: "Audiogram",
    category: "Podcast",
    description: "Audio-only episode → a captioned clip over a cover image or stock loop with a lower-third bar.",
    bring: "An audio file or a static-camera recording and a cover image",
    sizes: ["1:1", "9:16"],
    prompt:
      "There may be no useful video: use the cover image (ImageOverlay full width) or a slow stock loop matched to the topic as the visual. Pick a 30–60 s stretch with one clear idea. Lower-third style captions in line mode, 8 words per line, sentence case, with the speaker name in a LowerThird for the first 4 s. Remove pauses over 0.8 s, keep everything else. No punch-ins, no SFX, no music (the audio is the product). Progress bar at the bottom. End card with the episode name and podcast handle. Clean colour.",
    defaults: { captionStyle: "lower-third", colorPreset: "clean", targetDurationMs: 45000, platform: "linkedin", silenceThresholdMs: 800, removeFillers: false, hookFirst: true, punchIns: false, broll: true, brollEvery: 15000, progressBar: true, sfxOnCuts: false, transitions: "crossfade" },
    tags: ["podcast", "audiogram", "audio"],
    usesGenerative: false,
    isFeatured: false,
  },
];
