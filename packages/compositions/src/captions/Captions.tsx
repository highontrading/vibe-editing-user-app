import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PLATFORM_PRESETS, type CaptionSettings, type CaptionStyleId, type CaptionTrack, type EditScript, type Word } from "@vibe/edl";
import { groupWords, lineAt, type CaptionLine } from "./grouping";
import { fontStackFor, type FontKey } from "../fonts";
import { clamp, lerp } from "../lib/time";
import { seeded } from "../lib/noise";
import { luminance, safeColor, withAlpha } from "../lib/props";

type WordState = "past" | "active" | "future";

interface StyleDef {
  font: FontKey;
  weight: number;
  letterSpacing: number;
  /** Multiplier on settings.fontSize so the catalogue defaults look right. */
  sizeScale: number;
  lineHeight: number;
  container: "none" | "pill" | "box" | "bar" | "glow" | "mono";
  /** Opacity of not-yet-spoken words. */
  futureOpacity: number;
  pastOpacity: number;
  /** Scale the active word pops to in word mode. */
  popScale: number;
  textShadow: (color: string, size: number) => string;
  strokeWidth: (size: number) => number;
}

/** Horizontal padding of each word, in em. */
const WORD_PAD = 0.2;

/** Rough average glyph width per font (em), used to shrink lines that would overflow. */
const CHAR_WIDTH: Record<FontKey, number> = { anton: 0.42, "archivo-black": 0.74, montserrat: 0.68, inter: 0.58, "jetbrains-mono": 0.6, "bebas-neue": 0.4, poppins: 0.66, caveat: 0.46 };

/** Shrink the font (down to 65%) so a line fits the available width on one row where possible. */
export function fitFontSize(line: CaptionLine, def: StyleDef, fontSize: number, maxWidth: number, uppercase: boolean, emoji: boolean): number {
  const chars = line.words.reduce((n, w) => n + w.text.length, 0);
  const emojis = emoji ? line.words.filter((w) => w.emoji).length : 0;
  const est = chars * fontSize * CHAR_WIDTH[def.font] * (uppercase ? 1.08 : 1) * (1 + (def.popScale - 1)) + line.words.length * fontSize * (WORD_PAD * 2 + 0.06) + emojis * fontSize * 1.3;
  if (est <= maxWidth) return fontSize;
  return fontSize * Math.max(0.65, maxWidth / est);
}

const heavyShadow = (_: string, s: number) => `0 ${Math.round(s * 0.06)}px 0 rgba(0,0,0,0.9), 0 ${Math.round(s * 0.12)}px ${Math.round(s * 0.35)}px rgba(0,0,0,0.55)`;
const softShadow = (_: string, s: number) => `0 ${Math.round(s * 0.04)}px ${Math.round(s * 0.18)}px rgba(0,0,0,0.6)`;
const noShadow = () => "none";

const STYLE_DEFS: Record<CaptionStyleId, StyleDef> = {
  "bold-pop": { font: "anton", weight: 400, letterSpacing: 0.02, sizeScale: 1, lineHeight: 1.08, container: "none", futureOpacity: 1, pastOpacity: 1, popScale: 1.1, textShadow: heavyShadow, strokeWidth: () => 0 },
  "clean-minimal": { font: "inter", weight: 500, letterSpacing: 0, sizeScale: 1, lineHeight: 1.3, container: "none", futureOpacity: 0.55, pastOpacity: 0.85, popScale: 1.0, textShadow: softShadow, strokeWidth: () => 0 },
  hormozi: { font: "archivo-black", weight: 400, letterSpacing: 0.01, sizeScale: 1, lineHeight: 1.1, container: "none", futureOpacity: 1, pastOpacity: 1, popScale: 1.1, textShadow: (_, s) => `${Math.round(s * 0.05)}px ${Math.round(s * 0.06)}px 0 #000, 0 ${Math.round(s * 0.14)}px ${Math.round(s * 0.3)}px rgba(0,0,0,0.6)`, strokeWidth: (s) => s * 0.035 },
  karaoke: { font: "montserrat", weight: 800, letterSpacing: 0, sizeScale: 1, lineHeight: 1.25, container: "none", futureOpacity: 0.9, pastOpacity: 1, popScale: 1.0, textShadow: heavyShadow, strokeWidth: () => 0 },
  typewriter: { font: "jetbrains-mono", weight: 500, letterSpacing: 0, sizeScale: 1, lineHeight: 1.35, container: "mono", futureOpacity: 0, pastOpacity: 1, popScale: 1.0, textShadow: noShadow, strokeWidth: () => 0 },
  outline: { font: "bebas-neue", weight: 400, letterSpacing: 0.03, sizeScale: 1.1, lineHeight: 1.05, container: "none", futureOpacity: 1, pastOpacity: 1, popScale: 1.08, textShadow: (_, s) => `0 ${Math.round(s * 0.08)}px ${Math.round(s * 0.25)}px rgba(0,0,0,0.55)`, strokeWidth: (s) => s * 0.1 },
  glow: { font: "montserrat", weight: 700, letterSpacing: 0.01, sizeScale: 1, lineHeight: 1.3, container: "glow", futureOpacity: 0.6, pastOpacity: 0.85, popScale: 1.06, textShadow: noShadow, strokeWidth: () => 0 },
  boxed: { font: "inter", weight: 800, letterSpacing: 0, sizeScale: 1, lineHeight: 1.3, container: "box", futureOpacity: 0.7, pastOpacity: 0.95, popScale: 1.04, textShadow: noShadow, strokeWidth: () => 0 },
  "lower-third": { font: "inter", weight: 500, letterSpacing: 0, sizeScale: 1, lineHeight: 1.35, container: "bar", futureOpacity: 0.7, pastOpacity: 0.9, popScale: 1.0, textShadow: noShadow, strokeWidth: () => 0 },
  "two-line": { font: "inter", weight: 700, letterSpacing: 0, sizeScale: 1, lineHeight: 1.3, container: "none", futureOpacity: 0.8, pastOpacity: 0.9, popScale: 1.04, textShadow: heavyShadow, strokeWidth: () => 0 },
  "emoji-pop": { font: "poppins", weight: 800, letterSpacing: 0.01, sizeScale: 1, lineHeight: 1.15, container: "none", futureOpacity: 1, pastOpacity: 1, popScale: 1.1, textShadow: heavyShadow, strokeWidth: () => 0 },
  handwritten: { font: "caveat", weight: 700, letterSpacing: 0.01, sizeScale: 1.25, lineHeight: 1.2, container: "none", futureOpacity: 0.9, pastOpacity: 1, popScale: 1.06, textShadow: softShadow, strokeWidth: () => 0 },
};

export const CAPTION_FONT_FOR_STYLE: Record<CaptionStyleId, FontKey> = Object.fromEntries(
  (Object.keys(STYLE_DEFS) as CaptionStyleId[]).map((k) => [k, STYLE_DEFS[k].font]),
) as Record<CaptionStyleId, FontKey>;

/** Vertical anchor (px, centre of the caption block) honouring platform-safe margins. */
export function captionAnchorY(settings: CaptionSettings, script: EditScript, fontSize: number): number {
  const { width, height } = script.output;
  const platform = script.meta.platform;
  const vertical = height > width;
  const preset = platform ? PLATFORM_PRESETS[platform] : undefined;
  const safeTop = preset?.safeTop ?? (vertical ? 0.12 : 0.06);
  const safeBottom = preset?.safeBottom ?? (vertical ? 0.2 : 0.1);
  let y: number;
  if (settings.position === "top") y = height * safeTop + fontSize * 1.4;
  else if (settings.position === "center") y = height / 2;
  else y = height * (1 - safeBottom) - fontSize * 1.4;
  y += settings.offset * height * 0.12;
  return clamp(y, fontSize, height - fontSize);
}

function wordProgress(w: Word, tMs: number): number {
  return clamp((tMs - w.t) / Math.max(1, w.d), 0, 1);
}

interface WordViewProps {
  word: Word;
  state: WordState;
  styleId: CaptionStyleId;
  def: StyleDef;
  settings: CaptionSettings;
  fontSize: number;
  tMs: number;
  frame: number;
  fps: number;
  textColor: string;
  highlight: string;
}

const WordView: React.FC<WordViewProps> = ({ word, state, styleId, def, settings, fontSize, tMs, frame, fps, textColor, highlight }) => {
  const ageFrames = Math.max(0, ((tMs - word.t) / 1000) * fps);
  const wordMode = settings.mode === "word";
  const isActive = state === "active";
  const emphasised = Boolean(word.emphasis);
  const text = settings.uppercase ? word.text.toUpperCase() : word.text;
  const stroke = def.strokeWidth(fontSize);

  // Pop / fade / slide animation of the active word in word mode.
  let scale = 1;
  let translateY = 0;
  let opacity = state === "future" ? def.futureOpacity : state === "past" ? def.pastOpacity : 1;
  if (wordMode && isActive && settings.animation !== "none") {
    const s = spring({ frame: ageFrames, fps, config: { damping: 11, stiffness: 240, mass: 0.7 }, durationInFrames: Math.round(fps * 0.4) });
    if (settings.animation === "pop") scale = lerp(0.72, def.popScale, s);
    if (settings.animation === "fade") opacity = lerp(0.3, 1, s);
    if (settings.animation === "slide") {
      translateY = lerp(fontSize * 0.35, 0, s);
      opacity = lerp(0.2, 1, s);
    }
  } else if (wordMode && isActive) {
    scale = def.popScale;
  }

  let color = textColor;
  if (emphasised) color = highlight;
  else if (isActive && (wordMode || styleId === "two-line" || styleId === "karaoke" || styleId === "glow")) color = highlight;

  // Reserve room for the pop so a scaled word never collides with its neighbours (layout stays stable).
  const wordPad = fontSize * (WORD_PAD + (wordMode ? (def.popScale - 1) * 0.5 * CHAR_WIDTH[def.font] * text.length : 0));
  const base: React.CSSProperties = {
    display: "inline-block",
    color,
    opacity,
    fontWeight: def.weight,
    letterSpacing: `${def.letterSpacing}em`,
    textShadow: def.textShadow(color, fontSize),
    transform: `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(4)})`,
    transformOrigin: "50% 60%",
    whiteSpace: "pre",
    padding: `0 ${wordPad.toFixed(1)}px`,
    WebkitTextStroke: stroke > 0 ? `${stroke.toFixed(2)}px #000` : undefined,
    paintOrder: stroke > 0 ? "stroke fill" : undefined,
  };

  switch (styleId) {
    case "karaoke": {
      const fill = state === "past" ? 1 : state === "active" ? wordProgress(word, tMs) : 0;
      const pct = (fill * 100).toFixed(1);
      return (
        <span style={{ ...base, position: "relative", color: "transparent", textShadow: "none" }}>
          <span style={{ position: "absolute", inset: 0, padding: base.padding, color: textColor, textShadow: def.textShadow(textColor, fontSize), opacity: def.futureOpacity }}>{text}</span>
          <span
            style={{
              position: "relative",
              backgroundImage: `linear-gradient(90deg, ${highlight} ${pct}%, transparent ${pct}%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: `drop-shadow(0 ${Math.round(fontSize * 0.05)}px 0 rgba(0,0,0,0.7))`,
            }}
          >
            {text}
          </span>
        </span>
      );
    }
    case "handwritten": {
      const tilt = (seeded(word.text, String(word.t)) - 0.5) * 5;
      const wobble = Math.sin(frame / fps * 6 + word.t) * 0.6;
      const marker = isActive || emphasised;
      return (
        <span
          style={{
            ...base,
            color: textColor,
            transform: `${base.transform} rotate(${(tilt + wobble).toFixed(2)}deg)`,
            backgroundImage: marker ? `linear-gradient(100deg, transparent 2%, ${withAlpha(highlight, 0.75)} 4%, ${withAlpha(highlight, 0.75)} 96%, transparent 98%)` : undefined,
            backgroundSize: "100% 45%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "0 78%",
            borderRadius: 6,
          }}
        >
          {text}
        </span>
      );
    }
    case "glow": {
      const glowColor = isActive || emphasised ? highlight : withAlpha(textColor, 0.7);
      const intensity = isActive ? 1 : 0.35;
      return (
        <span
          style={{
            ...base,
            color: isActive || emphasised ? "#fff" : textColor,
            textShadow: `0 0 ${Math.round(fontSize * 0.12 * intensity + 2)}px ${glowColor}, 0 0 ${Math.round(fontSize * 0.35 * intensity + 4)}px ${glowColor}, 0 0 ${Math.round(fontSize * 0.8 * intensity)}px ${withAlpha(glowColor, 0.7)}`,
          }}
        >
          {text}
        </span>
      );
    }
    case "emoji-pop": {
      const showEmoji = settings.emoji && word.emoji;
      const bounce = spring({ frame: ageFrames, fps, config: { damping: 9, stiffness: 260, mass: 0.6 }, durationInFrames: Math.round(fps * 0.5) });
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(fontSize * 0.1) }}>
          <span style={base}>{text}</span>
          {showEmoji ? (
            <span
              style={{
                display: "inline-block",
                fontSize: fontSize * 1.1,
                lineHeight: 1,
                transform: `scale(${(state === "future" ? 0 : lerp(0.2, 1, bounce)).toFixed(3)}) rotate(${((1 - bounce) * -20).toFixed(1)}deg)`,
                filter: `drop-shadow(0 ${Math.round(fontSize * 0.06)}px ${Math.round(fontSize * 0.12)}px rgba(0,0,0,0.5))`,
              }}
            >
              {word.emoji}
            </span>
          ) : null}
        </span>
      );
    }
    default: {
      const showEmoji = settings.emoji && word.emoji && state !== "future";
      return (
        <span style={base}>
          {text}
          {showEmoji ? <span style={{ marginLeft: Math.round(fontSize * 0.15), textShadow: "none", WebkitTextStroke: 0 }}>{word.emoji}</span> : null}
        </span>
      );
    }
  }
};

/** Monospace typing of the line, char by char, with a blinking block cursor. */
const TypewriterLine: React.FC<{ line: CaptionLine; tMs: number; settings: CaptionSettings; fontSize: number; frame: number; fps: number; color: string; highlight: string }> = ({ line, tMs, settings, fontSize, frame, fps, color, highlight }) => {
  const parts: React.ReactNode[] = [];
  line.words.forEach((w, i) => {
    const full = settings.uppercase ? w.text.toUpperCase() : w.text;
    let visible: string;
    if (tMs >= w.t + w.d) visible = full;
    else if (tMs < w.t) visible = "";
    else visible = full.slice(0, Math.ceil(wordProgress(w, tMs) * full.length));
    if (!visible) return;
    parts.push(
      <span key={i} style={{ color: w.emphasis ? highlight : color }}>
        {visible}
        {visible.length === full.length && i < line.words.length - 1 ? " " : ""}
      </span>,
    );
  });
  const blink = Math.floor((frame / fps) * 2.4) % 2 === 0;
  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {parts}
      <span style={{ display: "inline-block", width: fontSize * 0.55, height: fontSize * 1.05, background: highlight, verticalAlign: "text-bottom", marginLeft: 2, opacity: blink ? 1 : 0.15, transform: "translateY(0.08em)" }} />
    </span>
  );
};

interface LineViewProps {
  line: CaptionLine;
  styleId: CaptionStyleId;
  settings: CaptionSettings;
  fontSize: number;
  tMs: number;
  frame: number;
  fps: number;
  width: number;
  fontFamily: string;
  dim?: boolean;
}

const LineView: React.FC<LineViewProps> = ({ line, styleId, settings, fontSize: baseFontSize, tMs, frame, fps, width, fontFamily, dim }) => {
  const def = STYLE_DEFS[styleId];
  const fits = def.container === "bar" || def.container === "mono" || styleId === "two-line" || styleId === "clean-minimal";
  const fontSize = fits ? baseFontSize : fitFontSize(line, def, baseFontSize, width * 0.9, settings.uppercase, settings.emoji);
  const textColor = safeColor(settings.color, "#FFFFFF");
  const highlight = safeColor(settings.highlightColor, "#FFD400");
  const lineAgeFrames = Math.max(0, ((tMs - line.startMs) / 1000) * fps);

  // Line entrance.
  let lineOpacity = 1;
  let lineScale = 1;
  let lineY = 0;
  if (settings.animation !== "none" && !dim) {
    const s = spring({ frame: lineAgeFrames, fps, config: { damping: 14, stiffness: 200, mass: 0.8 }, durationInFrames: Math.round(fps * 0.35) });
    if (settings.animation === "fade" || settings.mode === "line") lineOpacity = interpolate(lineAgeFrames, [0, fps * 0.18], [0, 1], { extrapolateRight: "clamp" });
    if (settings.animation === "pop" && settings.mode === "line") lineScale = lerp(0.9, 1, s);
    if (settings.animation === "slide") {
      lineY = lerp(fontSize * 0.6, 0, s);
      lineOpacity = Math.min(lineOpacity, s);
    }
  }
  if (dim) lineOpacity = 0.45;

  const isBoxLike = def.container === "box" || def.container === "bar" || def.container === "glow" || def.container === "mono";
  const boxBg = styleId === "boxed" ? highlight : undefined;
  const boxText = styleId === "boxed" ? (luminance(highlight) > 0.5 ? safeColor(settings.color, "#111111") : "#FFFFFF") : textColor;

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    flexWrap: "wrap",
    justifyContent: def.container === "bar" || def.container === "mono" ? "flex-start" : "center",
    alignItems: "center",
    textAlign: def.container === "bar" ? "left" : "center",
    gap: `0 ${Math.round(fontSize * 0.06)}px`,
    maxWidth: def.container === "bar" ? width * 0.92 : width * 0.9,
    fontFamily,
    fontSize,
    lineHeight: def.lineHeight,
    opacity: lineOpacity,
    transform: `translateY(${lineY.toFixed(2)}px) scale(${lineScale.toFixed(4)})`,
    transformOrigin: "50% 50%",
    textTransform: settings.uppercase ? "uppercase" : undefined,
  };
  if (def.container === "box") Object.assign(containerStyle, { background: boxBg, color: boxText, padding: `${Math.round(fontSize * 0.22)}px ${Math.round(fontSize * 0.45)}px`, borderRadius: Math.round(fontSize * 0.22), boxShadow: `0 ${Math.round(fontSize * 0.15)}px ${Math.round(fontSize * 0.5)}px rgba(0,0,0,0.35)` });
  if (def.container === "bar") Object.assign(containerStyle, { background: "rgba(8,8,12,0.72)", borderLeft: `${Math.max(4, Math.round(fontSize * 0.16))}px solid ${highlight}`, padding: `${Math.round(fontSize * 0.3)}px ${Math.round(fontSize * 0.7)}px`, borderRadius: Math.round(fontSize * 0.12), backdropFilter: "blur(10px)", width: width * 0.86 });
  if (def.container === "glow") Object.assign(containerStyle, { background: "rgba(8,6,18,0.55)", border: "1px solid rgba(255,255,255,0.14)", padding: `${Math.round(fontSize * 0.28)}px ${Math.round(fontSize * 0.6)}px`, borderRadius: 999, backdropFilter: "blur(16px)", boxShadow: `0 0 ${Math.round(fontSize * 0.8)}px ${withAlpha(highlight, 0.25)}, inset 0 0 ${Math.round(fontSize * 0.5)}px rgba(255,255,255,0.04)` });
  if (def.container === "mono") Object.assign(containerStyle, { background: "rgba(6,10,8,0.78)", border: `1px solid ${withAlpha(highlight, 0.35)}`, padding: `${Math.round(fontSize * 0.35)}px ${Math.round(fontSize * 0.6)}px`, borderRadius: Math.round(fontSize * 0.18), minWidth: width * 0.5 });

  const activeIdx = line.words.findIndex((w) => tMs >= w.t && tMs < w.t + w.d);
  const lastSpokenIdx = line.words.reduce((acc, w, i) => (tMs >= w.t ? i : acc), -1);

  let body: React.ReactNode;
  if (styleId === "typewriter") {
    body = <TypewriterLine line={line} tMs={tMs} settings={settings} fontSize={fontSize} frame={frame} fps={fps} color={textColor} highlight={highlight} />;
  } else {
    body = line.words.map((w, i) => {
      let state: WordState = "future";
      if (dim) state = "future";
      else if (i === activeIdx || (activeIdx === -1 && i === lastSpokenIdx)) state = "active";
      else if (i < lastSpokenIdx || tMs >= w.t + w.d) state = "past";
      return (
        <WordView key={`${w.t}-${i}`} word={w} state={state} styleId={styleId} def={def} settings={settings} fontSize={fontSize} tMs={tMs} frame={frame} fps={fps} textColor={isBoxLike && styleId === "boxed" ? boxText : textColor} highlight={styleId === "boxed" ? boxText : highlight} />
      );
    });
  }

  return <div style={containerStyle}>{body}</div>;
};

export const Captions: React.FC<{ track: CaptionTrack; script: EditScript }> = ({ track, script }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const tMs = (frame / fps) * 1000;
  const settings = track.settings;
  const styleId: CaptionStyleId = (STYLE_DEFS as Record<string, StyleDef>)[track.style] ? track.style : "bold-pop";
  const def = STYLE_DEFS[styleId];
  const fontSize = Math.max(8, settings.fontSize * def.sizeScale);
  const fontFamily = fontStackFor(def.font, settings.fontFamily);
  const lines = useMemo(() => groupWords(track.words, settings.maxWordsPerLine), [track.words, settings.maxWordsPerLine]);

  const line = lineAt(lines, tMs);
  if (!line) return null;
  const next = styleId === "two-line" ? lines[line.index + 1] : undefined;
  const anchorY = captionAnchorY(settings, script, fontSize);
  const left = def.container === "bar" ? width * 0.07 : width * 0.05;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left,
          right: width * 0.05,
          top: anchorY,
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: def.container === "bar" ? "flex-start" : "center",
          gap: Math.round(fontSize * 0.25),
        }}
      >
        <LineView line={line} styleId={styleId} settings={settings} fontSize={fontSize} tMs={tMs} frame={frame} fps={fps} width={width} fontFamily={fontFamily} />
        {next ? <LineView line={next} styleId={styleId} settings={settings} fontSize={fontSize} tMs={tMs} frame={frame} fps={fps} width={width} fontFamily={fontFamily} dim /> : null}
      </div>
    </AbsoluteFill>
  );
};
