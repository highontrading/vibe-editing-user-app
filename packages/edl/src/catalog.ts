/**
 * Catalogue of everything the AI and the UI can pick from. The compositions
 * package implements each entry. Keep ids in sync with schema.ts constants.
 */
import type { CaptionStyleId, GraphicComponentId, MusicMood, TransitionType, EffectType, ColorPreset } from "./schema.js";

export interface CaptionStyleInfo {
  id: CaptionStyleId;
  name: string;
  description: string;
  /** suggested defaults */
  defaults: { fontSize?: number; position?: "top" | "center" | "bottom"; uppercase?: boolean; highlightColor?: string; color?: string; mode?: "word" | "line"; animation?: "pop" | "fade" | "slide" | "none"; maxWordsPerLine?: number; emoji?: boolean };
  vibe: string[];
}

export const CAPTION_STYLES: CaptionStyleInfo[] = [
  { id: "bold-pop", name: "Bold Pop", description: "Big bold white words that pop in one at a time, keyword in yellow.", defaults: { fontSize: 72, position: "center", uppercase: true, highlightColor: "#FFD400", mode: "word", animation: "pop", maxWordsPerLine: 3 }, vibe: ["talking-head", "shorts", "energetic"] },
  { id: "clean-minimal", name: "Clean Minimal", description: "Thin sans-serif lines at the bottom, no animation. Calm and premium.", defaults: { fontSize: 44, position: "bottom", uppercase: false, mode: "line", animation: "fade", maxWordsPerLine: 6 }, vibe: ["explainer", "product", "calm"] },
  { id: "hormozi", name: "Hormozi", description: "Chunky uppercase words with a green/yellow highlight and a drop shadow.", defaults: { fontSize: 80, position: "center", uppercase: true, highlightColor: "#3DFF6E", mode: "word", animation: "pop", maxWordsPerLine: 3 }, vibe: ["talking-head", "business", "hype"] },
  { id: "karaoke", name: "Karaoke", description: "A full line is shown and each word fills with colour as it is spoken.", defaults: { fontSize: 56, position: "bottom", mode: "line", animation: "none", maxWordsPerLine: 5, highlightColor: "#FF4D6D" }, vibe: ["music", "vlog", "lyrics"] },
  { id: "typewriter", name: "Typewriter", description: "Monospace letters typed in with a blinking cursor.", defaults: { fontSize: 48, position: "bottom", mode: "line", animation: "none", maxWordsPerLine: 6 }, vibe: ["tech", "explainer", "retro"] },
  { id: "outline", name: "Outline", description: "White words with a thick black outline. Readable on anything.", defaults: { fontSize: 64, position: "bottom", uppercase: true, mode: "word", animation: "pop", maxWordsPerLine: 4 }, vibe: ["vlog", "travel", "outdoor"] },
  { id: "glow", name: "Glow", description: "Neon glow words on a dark blurred pill.", defaults: { fontSize: 60, position: "center", mode: "word", animation: "fade", highlightColor: "#7CF0FF", maxWordsPerLine: 3 }, vibe: ["music", "night", "effect"] },
  { id: "boxed", name: "Boxed", description: "Each line in a solid colour box, Instagram-story style.", defaults: { fontSize: 52, position: "bottom", mode: "line", animation: "slide", maxWordsPerLine: 5, highlightColor: "#FFFFFF", color: "#111111" }, vibe: ["ugc", "ad", "story"] },
  { id: "lower-third", name: "Lower Third", description: "Small clean captions in a lower-third bar; broadcast feel.", defaults: { fontSize: 38, position: "bottom", mode: "line", animation: "slide", maxWordsPerLine: 8 }, vibe: ["interview", "podcast", "corporate"] },
  { id: "two-line", name: "Two Line", description: "Two centred lines, current word brightened. Great for long talking segments.", defaults: { fontSize: 50, position: "bottom", mode: "line", animation: "fade", maxWordsPerLine: 5 }, vibe: ["podcast", "talking-head", "clipping"] },
  { id: "emoji-pop", name: "Emoji Pop", description: "Bold words with a matching emoji that bounces in on keywords.", defaults: { fontSize: 68, position: "center", uppercase: true, mode: "word", animation: "pop", emoji: true, maxWordsPerLine: 3 }, vibe: ["ugc", "fun", "tiktok"] },
  { id: "handwritten", name: "Handwritten", description: "Casual handwritten font with a slight wobble; vlog diary feel.", defaults: { fontSize: 58, position: "bottom", mode: "line", animation: "fade", maxWordsPerLine: 5 }, vibe: ["vlog", "travel", "aesthetic"] },
];

export interface ComponentInfo {
  id: GraphicComponentId;
  name: string;
  description: string;
  /** JSON-schema-ish description of props for the agent */
  props: Record<string, { type: "string" | "number" | "boolean" | "color" | "enum"; description: string; options?: string[]; default?: unknown }>;
  defaultDurationMs: number;
}

export const COMPONENT_CATALOG: ComponentInfo[] = [
  { id: "KineticTitle", name: "Kinetic Title", description: "Large animated title, words fly in one by one. Use for hooks and section titles.", props: { text: { type: "string", description: "Title text" }, subtitle: { type: "string", description: "Optional smaller line" }, color: { type: "color", description: "Text colour", default: "#FFFFFF" }, accent: { type: "color", description: "Accent colour", default: "#FFD400" }, align: { type: "enum", description: "Vertical placement", options: ["top", "center", "bottom"], default: "center" }, style: { type: "enum", description: "Animation style", options: ["slam", "rise", "typewriter", "blur"], default: "slam" } }, defaultDurationMs: 2500 },
  { id: "LowerThird", name: "Lower Third", description: "Name and title bar sliding in at the bottom left.", props: { name: { type: "string", description: "Primary text" }, title: { type: "string", description: "Secondary text" }, accent: { type: "color", description: "Bar colour", default: "#FFD400" } }, defaultDurationMs: 4000 },
  { id: "EndCard", name: "End Card", description: "Closing card with a call to action and handle.", props: { headline: { type: "string", description: "Main CTA e.g. Follow for more" }, handle: { type: "string", description: "@handle" }, accent: { type: "color", description: "Accent colour", default: "#FFD400" }, background: { type: "color", description: "Background colour", default: "#0B0B0F" } }, defaultDurationMs: 3000 },
  { id: "ProgressBar", name: "Progress Bar", description: "Thin bar across the top or bottom that fills over the whole video.", props: { position: { type: "enum", description: "Edge", options: ["top", "bottom"], default: "top" }, color: { type: "color", description: "Bar colour", default: "#FFD400" }, thickness: { type: "number", description: "Pixels", default: 8 } }, defaultDurationMs: 0 },
  { id: "SubscribeBubble", name: "Subscribe Bubble", description: "Small animated 'Follow / Subscribe' pill with a pointer click.", props: { label: { type: "string", description: "Button text", default: "Follow" }, platform: { type: "enum", description: "Icon", options: ["youtube", "instagram", "tiktok", "generic"], default: "generic" } }, defaultDurationMs: 2500 },
  { id: "PointerHighlight", name: "Pointer Highlight", description: "Circle/arrow highlight over a screen area, for product demos.", props: { x: { type: "number", description: "0-1 horizontal position", default: 0.5 }, y: { type: "number", description: "0-1 vertical position", default: 0.5 }, radius: { type: "number", description: "Pixels", default: 120 }, color: { type: "color", description: "Ring colour", default: "#FF4D6D" }, label: { type: "string", description: "Optional label" } }, defaultDurationMs: 2000 },
  { id: "TextCallout", name: "Text Callout", description: "Short text in a rounded pill anywhere on screen, e.g. a stat or a reaction.", props: { text: { type: "string", description: "Text" }, x: { type: "number", description: "0-1 horizontal", default: 0.5 }, y: { type: "number", description: "0-1 vertical", default: 0.3 }, color: { type: "color", description: "Text colour", default: "#111111" }, background: { type: "color", description: "Pill colour", default: "#FFFFFF" }, size: { type: "enum", description: "Size", options: ["sm", "md", "lg"], default: "md" } }, defaultDurationMs: 2000 },
  { id: "ImageOverlay", name: "Image Overlay", description: "Picture-in-picture image or logo with a drop shadow; good for product shots and screenshots.", props: { assetId: { type: "string", description: "Image asset id from script.assets" }, x: { type: "number", description: "0-1 horizontal centre", default: 0.5 }, y: { type: "number", description: "0-1 vertical centre", default: 0.5 }, width: { type: "number", description: "0-1 fraction of output width", default: 0.6 }, animation: { type: "enum", description: "Entrance", options: ["pop", "slide", "fade"], default: "pop" }, rounded: { type: "boolean", description: "Rounded corners", default: true } }, defaultDurationMs: 3000 },
  { id: "LogoBug", name: "Logo Bug", description: "Small persistent logo in a corner.", props: { assetId: { type: "string", description: "Image asset id" }, corner: { type: "enum", description: "Corner", options: ["tl", "tr", "bl", "br"], default: "tr" }, size: { type: "number", description: "0-1 fraction of width", default: 0.12 }, opacity: { type: "number", description: "0-1", default: 0.9 } }, defaultDurationMs: 0 },
  { id: "ChapterCard", name: "Chapter Card", description: "Full-screen numbered chapter card between sections.", props: { number: { type: "string", description: "e.g. 01" }, title: { type: "string", description: "Chapter title" }, background: { type: "color", description: "Background", default: "#0B0B0F" }, accent: { type: "color", description: "Accent", default: "#FFD400" } }, defaultDurationMs: 1800 },
  { id: "CountdownTimer", name: "Countdown", description: "Big number counting down, for listicles and reveals.", props: { from: { type: "number", description: "Start number", default: 3 }, color: { type: "color", description: "Colour", default: "#FFFFFF" } }, defaultDurationMs: 3000 },
  { id: "SplitScreen", name: "Split Screen Label", description: "Labels for top/bottom or left/right split layouts.", props: { a: { type: "string", description: "First label" }, b: { type: "string", description: "Second label" }, orientation: { type: "enum", description: "Layout", options: ["vertical", "horizontal"], default: "vertical" } }, defaultDurationMs: 3000 },
];

export const TRANSITIONS: { id: TransitionType; name: string; description: string; defaultMs: number }[] = [
  { id: "cut", name: "Cut", description: "Hard cut", defaultMs: 0 },
  { id: "crossfade", name: "Crossfade", description: "Soft dissolve", defaultMs: 400 },
  { id: "whip", name: "Whip Pan", description: "Fast horizontal blur whip", defaultMs: 250 },
  { id: "zoom", name: "Zoom", description: "Punch zoom through the cut", defaultMs: 300 },
  { id: "slide", name: "Slide", description: "Next clip slides in", defaultMs: 350 },
  { id: "flash", name: "Flash", description: "White flash", defaultMs: 150 },
  { id: "glitch", name: "Glitch", description: "RGB split glitch", defaultMs: 200 },
  { id: "dip-to-black", name: "Dip to Black", description: "Fade through black", defaultMs: 500 },
];

export const EFFECTS: { id: EffectType; name: string; description: string; params: string }[] = [
  { id: "colorGrade", name: "Colour Grade", description: "Apply a colour preset to this clip", params: "preset: one of COLOR_PRESETS" },
  { id: "grain", name: "Film Grain", description: "Analogue grain", params: "amount 0-1" },
  { id: "vignette", name: "Vignette", description: "Dark edges", params: "amount 0-1" },
  { id: "blur", name: "Blur", description: "Gaussian blur, e.g. for backgrounds", params: "px" },
  { id: "lightLeak", name: "Light Leak", description: "Warm light leak sweep", params: "intensity 0-1" },
  { id: "shake", name: "Camera Shake", description: "Handheld shake", params: "intensity 0-1" },
  { id: "zoomPulse", name: "Zoom Pulse", description: "Rhythmic zoom pulses on the beat", params: "amount 0-0.3, bpm" },
  { id: "speedRamp", name: "Speed Ramp", description: "Ramp speed within the clip", params: "from, to (multipliers)" },
];

export const COLOR_PRESET_INFO: { id: ColorPreset; name: string; description: string }[] = [
  { id: "none", name: "None", description: "Untouched" },
  { id: "warm-film", name: "Warm Film", description: "Warm highlights, lifted blacks, slight grain" },
  { id: "clean", name: "Clean", description: "Neutral, slightly brighter and sharper" },
  { id: "moody", name: "Moody", description: "Desaturated, crushed blacks, cool shadows" },
  { id: "vibrant", name: "Vibrant", description: "Punchy saturation and contrast" },
  { id: "bw", name: "Black & White", description: "High-contrast monochrome" },
  { id: "teal-orange", name: "Teal & Orange", description: "Cinematic complementary grade" },
];

export const MUSIC_MOOD_INFO: { id: MusicMood; name: string; bpm: [number, number]; description: string }[] = [
  { id: "upbeat", name: "Upbeat", bpm: [110, 130], description: "Bright, positive, driving" },
  { id: "lofi", name: "Lo-fi", bpm: [70, 90], description: "Chill hip-hop beat, warm" },
  { id: "cinematic", name: "Cinematic", bpm: [60, 100], description: "Strings, swells, epic" },
  { id: "chill", name: "Chill", bpm: [80, 100], description: "Soft, relaxed, ambient" },
  { id: "energetic", name: "Energetic", bpm: [125, 150], description: "Fast, punchy, EDM/trap" },
  { id: "emotional", name: "Emotional", bpm: [60, 85], description: "Piano, heartfelt" },
  { id: "corporate", name: "Corporate", bpm: [95, 115], description: "Clean, optimistic, safe" },
  { id: "funky", name: "Funky", bpm: [100, 120], description: "Groovy bass, retro" },
  { id: "dark", name: "Dark", bpm: [80, 120], description: "Tense, mysterious" },
  { id: "acoustic", name: "Acoustic", bpm: [85, 110], description: "Guitar, organic, warm" },
];

export const SFX_LIBRARY: { id: string; name: string; description: string; durationMs: number }[] = [
  { id: "sfx-whoosh-1", name: "Whoosh", description: "Fast air whoosh for cuts and text", durationMs: 500 },
  { id: "sfx-whoosh-2", name: "Soft whoosh", description: "Gentle whoosh for transitions", durationMs: 600 },
  { id: "sfx-pop", name: "Pop", description: "Short pop for words/emoji appearing", durationMs: 200 },
  { id: "sfx-click", name: "Click", description: "UI click", durationMs: 120 },
  { id: "sfx-ding", name: "Ding", description: "Notification ding for key points", durationMs: 700 },
  { id: "sfx-riser", name: "Riser", description: "Tension riser before a reveal", durationMs: 2000 },
  { id: "sfx-impact", name: "Impact", description: "Deep boom for title slams", durationMs: 900 },
  { id: "sfx-camera", name: "Camera shutter", description: "Shutter click for photo moments", durationMs: 300 },
  { id: "sfx-swoosh-reverse", name: "Reverse swoosh", description: "Reverse swell into a cut", durationMs: 800 },
  { id: "sfx-glitch", name: "Glitch", description: "Digital glitch burst", durationMs: 400 },
  { id: "sfx-typing", name: "Typing", description: "Keyboard typing loop", durationMs: 1500 },
  { id: "sfx-cash", name: "Cash register", description: "Ka-ching for money moments", durationMs: 900 },
];

/** Compact text version of the catalogue for the agent's system prompt. */
export function catalogForPrompt(): string {
  const lines: string[] = [];
  lines.push("CAPTION STYLES: " + CAPTION_STYLES.map((s) => `${s.id} (${s.description} vibe: ${s.vibe.join("/")})`).join("; "));
  lines.push("GRAPHIC COMPONENTS:");
  for (const c of COMPONENT_CATALOG) {
    const props = Object.entries(c.props).map(([k, v]) => `${k}:${v.type}${v.options ? `[${v.options.join("|")}]` : ""}${v.default !== undefined ? `=${JSON.stringify(v.default)}` : ""}`).join(", ");
    lines.push(`- ${c.id}: ${c.description} props{${props}} default ${c.defaultDurationMs}ms`);
  }
  lines.push("TRANSITIONS: " + TRANSITIONS.map((t) => `${t.id}(${t.defaultMs}ms)`).join(", "));
  lines.push("EFFECTS: " + EFFECTS.map((e) => `${e.id}{${e.params}}`).join("; "));
  lines.push("COLOR PRESETS: " + COLOR_PRESET_INFO.map((c) => `${c.id} (${c.description})`).join("; "));
  lines.push("MUSIC MOODS: " + MUSIC_MOOD_INFO.map((m) => `${m.id} (${m.description}, ${m.bpm[0]}-${m.bpm[1]} bpm)`).join("; "));
  lines.push("SFX: " + SFX_LIBRARY.map((s) => `${s.id} (${s.description})`).join("; "));
  return lines.join("\n");
}
