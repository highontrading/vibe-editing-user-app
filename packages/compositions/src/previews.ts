import {
  CAPTION_STYLES,
  CaptionSettingsSchema,
  COMPONENT_CATALOG,
  emptyScript,
  type CaptionStyleId,
  type EditScript,
  type GraphicComponentId,
  type TransitionType,
  type Word,
} from "@vibe/edl";

/** A self-contained gradient image (data URI) usable as an `image` asset: no network needed. */
export function gradientImageUrl(from: string, to: string, angle = 135, width = 1080, height = 1920): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'><defs><linearGradient id='g' gradientTransform='rotate(${angle} 0.5 0.5)'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient><radialGradient id='r' cx='0.5' cy='0.42' r='0.6'><stop offset='0' stop-color='white' stop-opacity='0.16'/><stop offset='1' stop-color='white' stop-opacity='0'/></radialGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><rect width='100%' height='100%' fill='url(#r)'/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** A simple "logo" mark as a data URI, for ImageOverlay / LogoBug previews. */
export function logoImageUrl(letter = "V", bg = "#FFD400", fg = "#111111", size = 512): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'><rect width='100%' height='100%' rx='${size * 0.22}' fill='${bg}'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='Arial Black, Arial, sans-serif' font-weight='900' font-size='${size * 0.56}' fill='${fg}'>${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const GRADIENTS: [string, string][] = [
  ["#1e1b4b", "#0f172a"],
  ["#7c2d12", "#1c1917"],
  ["#064e3b", "#0f172a"],
  ["#4a044e", "#111827"],
  ["#0c4a6e", "#111827"],
  ["#3f3f46", "#09090b"],
];

function addBackgroundClip(s: EditScript, gradient: [string, string], durationMs: number, id = "bg"): void {
  const { width, height } = s.output;
  s.assets[id] = { id, kind: "image", url: gradientImageUrl(gradient[0], gradient[1], 135, width, height), name: "Background", source: "generated", width, height };
  const main = s.tracks.find((t) => t.kind === "video");
  if (main && main.kind === "video") {
    main.clips.push({ id: `clip-${id}`, assetId: id, startMs: 0, inMs: 0, outMs: durationMs, speed: 1, volume: 0, transform: { scale: 1, x: 0, y: 0, rotate: 0 }, effects: [] });
  }
}

export const PREVIEW_WORDS: { text: string; emphasis?: boolean; emoji?: string }[] = [
  { text: "this" },
  { text: "is" },
  { text: "how" },
  { text: "your" },
  { text: "captions", emphasis: true, emoji: "🔥" },
  { text: "look" },
  { text: "on" },
  { text: "every" },
  { text: "video", emphasis: true, emoji: "🎬" },
  { text: "you" },
  { text: "make" },
];

/** A tiny script that shows a caption style on a dark gradient, for galleries. Loops cleanly. */
export function captionPreviewScript(style: CaptionStyleId): EditScript {
  const s = emptyScript({ aspect: "9:16" });
  const info = CAPTION_STYLES.find((c) => c.id === style);
  const step = 360;
  const words: Word[] = PREVIEW_WORDS.map((w, i) => ({ t: 300 + i * step, d: step - 30, text: w.text, emphasis: w.emphasis, emoji: w.emoji }));
  const durationMs = 300 + PREVIEW_WORDS.length * step + 500;
  const idx = Math.max(0, CAPTION_STYLES.findIndex((c) => c.id === style));
  addBackgroundClip(s, GRADIENTS[idx % GRADIENTS.length], durationMs);
  const cap = s.tracks.find((t) => t.kind === "captions");
  if (cap && cap.kind === "captions") {
    cap.style = style;
    cap.settings = CaptionSettingsSchema.parse({ ...info?.defaults, position: "center" });
    cap.words = words;
  }
  s.meta.title = info?.name ?? style;
  s.output.durationMs = durationMs;
  return s;
}

const GRAPHIC_SAMPLE_PROPS: Record<GraphicComponentId, Record<string, unknown>> = {
  KineticTitle: { text: "Stop scrolling", subtitle: "this changes everything", style: "slam" },
  LowerThird: { name: "Alex Rivera", title: "Founder, Vibe" },
  EndCard: { headline: "Follow for more", handle: "@vibe" },
  ProgressBar: { position: "top", color: "#FFD400", thickness: 10 },
  SubscribeBubble: { label: "Follow", platform: "youtube" },
  PointerHighlight: { x: 0.5, y: 0.42, radius: 140, label: "Tap here" },
  TextCallout: { text: "+312% growth", x: 0.5, y: 0.35, size: "lg" },
  ImageOverlay: { assetId: "logo", width: 0.5, animation: "pop" },
  LogoBug: { assetId: "logo", corner: "tr", size: 0.14 },
  ChapterCard: { number: "01", title: "The hook" },
  CountdownTimer: { from: 3 },
  SplitScreen: { a: "Before", b: "After", orientation: "vertical" },
};

/** A small script showing one graphic component over a gradient, for galleries. */
export function graphicPreviewScript(component: GraphicComponentId, aspect: "9:16" | "16:9" | "1:1" | "4:5" = "9:16"): EditScript {
  const s = emptyScript({ aspect });
  const info = COMPONENT_CATALOG.find((c) => c.id === component);
  const durationMs = info && info.defaultDurationMs > 0 ? Math.max(2500, info.defaultDurationMs) : 3000;
  const idx = Math.max(0, COMPONENT_CATALOG.findIndex((c) => c.id === component));
  addBackgroundClip(s, GRADIENTS[(idx + 2) % GRADIENTS.length], durationMs);
  s.assets.logo = { id: "logo", kind: "image", url: logoImageUrl("V"), name: "Logo", source: "brand", width: 512, height: 512 };
  const defaults = Object.fromEntries(Object.entries(info?.props ?? {}).filter(([, v]) => v.default !== undefined).map(([k, v]) => [k, v.default]));
  s.tracks.push({
    id: "gfx",
    kind: "graphics",
    name: "Graphics",
    items: [{ id: `g-${component}`, component, startMs: 0, durationMs: info?.defaultDurationMs === 0 ? 0 : durationMs, props: { ...defaults, ...GRAPHIC_SAMPLE_PROPS[component] } }],
  });
  const cap = s.tracks.find((t) => t.kind === "captions");
  if (cap && cap.kind === "captions") cap.enabled = false;
  s.meta.title = info?.name ?? component;
  s.output.durationMs = durationMs;
  return s;
}

/** Two gradient clips joined by the given transition, for galleries. */
export function transitionPreviewScript(type: TransitionType, aspect: "9:16" | "16:9" | "1:1" | "4:5" = "9:16"): EditScript {
  const s = emptyScript({ aspect });
  const { width, height } = s.output;
  const clipMs = 1300;
  const durationMs = type === "cut" ? 300 : 500;
  s.assets.a = { id: "a", kind: "image", url: gradientImageUrl("#f97316", "#7c2d12", 120, width, height), name: "A", source: "generated", width, height };
  s.assets.b = { id: "b", kind: "image", url: gradientImageUrl("#06b6d4", "#1e1b4b", 160, width, height), name: "B", source: "generated", width, height };
  const main = s.tracks.find((t) => t.kind === "video");
  if (main && main.kind === "video") {
    main.clips.push(
      { id: "clip-a", assetId: "a", startMs: 0, inMs: 0, outMs: clipMs, speed: 1, volume: 0, transform: { scale: 1, x: 0, y: 0, rotate: 0 }, effects: [] },
      { id: "clip-b", assetId: "b", startMs: clipMs, inMs: 0, outMs: clipMs, speed: 1, volume: 0, transform: { scale: 1, x: 0, y: 0, rotate: 0 }, effects: [], transitionIn: { type, durationMs } },
    );
  }
  s.tracks.push({
    id: "gfx",
    kind: "graphics",
    name: "Labels",
    items: [
      { id: "la", component: "TextCallout", startMs: 0, durationMs: clipMs, props: { text: "A", size: "lg", background: "rgba(0,0,0,0.45)", color: "#fff", y: 0.5 } },
      { id: "lb", component: "TextCallout", startMs: clipMs + durationMs, durationMs: clipMs - durationMs, props: { text: "B", size: "lg", background: "rgba(0,0,0,0.45)", color: "#fff", y: 0.5 } },
    ],
  });
  const cap = s.tracks.find((t) => t.kind === "captions");
  if (cap && cap.kind === "captions") cap.enabled = false;
  s.meta.title = type;
  s.output.durationMs = clipMs * 2;
  return s;
}
