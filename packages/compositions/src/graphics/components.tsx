import React from "react";
import { interpolate, spring } from "remotion";
import type { AssetRef } from "@vibe/edl";
import { Fill, SafeImage, easeOutBack, unit, useTiming } from "./shared";
import { loadFontStack } from "../fonts";
import { bool, color, num, oneOf, str, withAlpha, luminance, type Rec } from "../lib/props";
import { clamp, lerp } from "../lib/time";

export interface GraphicProps {
  props: Rec;
  assets: Record<string, AssetRef>;
  /** Absolute composition frame (for whole-video items such as ProgressBar). */
  absoluteFrame: number;
  totalFrames: number;
}

/* ------------------------------------------------------------------ */
/* KineticTitle                                                         */
/* ------------------------------------------------------------------ */

const TITLE_STYLES = ["slam", "rise", "typewriter", "blur"] as const;
const ALIGNS = ["top", "center", "bottom"] as const;

export const KineticTitle: React.FC<GraphicProps> = ({ props }) => {
  const t = useTiming({ exitMs: 350 });
  const u = unit(t.width, t.height);
  const text = str(props, "text", "Your title here");
  const subtitle = str(props, "subtitle");
  const textColor = color(props, "color", "#FFFFFF");
  const accent = color(props, "accent", "#FFD400");
  const align = oneOf(props, "align", ALIGNS, "center");
  const style = oneOf(props, "style", TITLE_STYLES, "slam");
  const words = text.split(/\s+/).filter(Boolean);
  const isSlam = style === "slam";
  const font = loadFontStack(isSlam ? "anton" : style === "typewriter" ? "jetbrains-mono" : "montserrat");
  const subFont = loadFontStack("inter");
  const longest = words.reduce((m, w) => Math.max(m, w.length), 1);
  const fontSize = clamp((t.width * 0.82) / Math.max(longest * (isSlam ? 0.5 : 0.62), words.join(" ").length * 0.17), u * 6, u * 18);
  const stagger = Math.round(t.fps * (style === "typewriter" ? 0.05 : 0.11));

  const justify = align === "top" ? "flex-start" : align === "bottom" ? "flex-end" : "center";
  const exitScale = lerp(1, 1.06, t.exit);
  const exitOpacity = 1 - t.exit;

  let body: React.ReactNode;
  if (style === "typewriter") {
    const total = text.length;
    const shown = Math.min(total, Math.floor(t.frame / Math.max(1, stagger / 2.2)));
    const blink = Math.floor((t.frame / t.fps) * 2.5) % 2 === 0;
    body = (
      <span style={{ whiteSpace: "pre-wrap" }}>
        {text.slice(0, shown)}
        <span style={{ display: "inline-block", width: fontSize * 0.55, height: fontSize * 0.95, background: accent, verticalAlign: "text-bottom", marginLeft: 4, opacity: blink ? 1 : 0.1 }} />
      </span>
    );
  } else {
    body = words.map((w, i) => {
      const local = t.frame - i * stagger;
      const s = spring({ frame: Math.max(0, local), fps: t.fps, config: isSlam ? { damping: 12, stiffness: 300, mass: 0.9 } : { damping: 16, stiffness: 160, mass: 0.8 } });
      const visible = local >= 0;
      let transform = "";
      let filter: string | undefined;
      let opacity = visible ? 1 : 0;
      if (isSlam) {
        transform = `scale(${lerp(2.6, 1, s).toFixed(3)}) rotate(${lerp(i % 2 ? 6 : -6, 0, s).toFixed(2)}deg)`;
        opacity = visible ? Math.min(1, s * 1.5) : 0;
      } else if (style === "rise") {
        transform = `translateY(${lerp(fontSize * 0.9, 0, s).toFixed(2)}px)`;
        opacity = visible ? interpolate(local, [0, t.fps * 0.25], [0, 1], { extrapolateRight: "clamp" }) : 0;
      } else {
        filter = `blur(${lerp(24, 0, s).toFixed(2)}px)`;
        transform = `scale(${lerp(1.15, 1, s).toFixed(3)})`;
        opacity = visible ? s : 0;
      }
      const highlighted = isSlam && words.length > 1 && i === words.length - 1;
      return (
        <span key={i} style={{ display: "inline-block", margin: `0 ${fontSize * 0.12}px`, transform, opacity, filter, color: highlighted ? accent : textColor, willChange: "transform" }}>
          {isSlam ? w.toUpperCase() : w}
        </span>
      );
    });
  }

  const underline = interpolate(t.frame, [words.length * stagger, words.length * stagger + t.fps * 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Fill style={{ justifyContent: justify, alignItems: "center", padding: `${u * 10}px ${u * 6}px` }}>
      <div style={{ textAlign: "center", opacity: exitOpacity, transform: `scale(${exitScale.toFixed(3)})`, maxWidth: "92%" }}>
        <div style={{ fontFamily: font, fontSize, fontWeight: isSlam ? 400 : 900, lineHeight: 1.05, color: textColor, textShadow: `0 ${u * 0.6}px ${u * 2.5}px rgba(0,0,0,0.55)`, display: "flex", flexWrap: "wrap", justifyContent: "center", letterSpacing: isSlam ? "0.01em" : "-0.01em" }}>{body}</div>
        {style !== "typewriter" ? <div style={{ height: Math.max(4, u * 0.9), width: `${(underline * 38).toFixed(1)}%`, background: accent, margin: `${u * 1.8}px auto 0`, borderRadius: 999, boxShadow: `0 0 ${u * 2}px ${withAlpha(accent, 0.6)}` }} /> : null}
        {subtitle ? (
          <div style={{ fontFamily: subFont, fontWeight: 500, fontSize: fontSize * 0.36, color: withAlpha(textColor, 0.85), marginTop: u * 1.6, letterSpacing: "0.04em", opacity: interpolate(t.frame, [words.length * stagger, words.length * stagger + t.fps * 0.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), textShadow: `0 ${u * 0.3}px ${u * 1.5}px rgba(0,0,0,0.6)` }}>
            {subtitle}
          </div>
        ) : null}
      </div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* LowerThird                                                           */
/* ------------------------------------------------------------------ */

export const LowerThird: React.FC<GraphicProps> = ({ props }) => {
  const t = useTiming({ exitMs: 300, damping: 16 });
  const u = unit(t.width, t.height);
  const name = str(props, "name", "Your Name");
  const title = str(props, "title");
  const accent = color(props, "accent", "#FFD400");
  const font = loadFontStack("inter");
  const slide = lerp(-t.width * 0.6, 0, t.enter) + lerp(0, -t.width * 0.6, easeOutBack(t.exit) * t.exit);
  const nameSize = u * 5.2;
  const vertical = t.height > t.width;
  const bottom = vertical ? t.height * 0.24 : t.height * 0.12;
  const barGrow = interpolate(t.frame, [t.fps * 0.1, t.fps * 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Fill>
      <div style={{ position: "absolute", left: u * 6, bottom, transform: `translateX(${slide.toFixed(1)}px)`, display: "flex", alignItems: "stretch", fontFamily: font, filter: `drop-shadow(0 ${u}px ${u * 2.5}px rgba(0,0,0,0.45))` }}>
        <div style={{ width: u * 1.6, background: accent, borderRadius: u * 0.4, transform: `scaleY(${Math.max(0.05, barGrow)})`, transformOrigin: "bottom" }} />
        <div style={{ marginLeft: u * 2.2, background: "rgba(10,10,14,0.78)", backdropFilter: "blur(14px)", borderRadius: u * 1.4, padding: `${u * 1.8}px ${u * 3.4}px`, overflow: "hidden" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: nameSize, lineHeight: 1.1, letterSpacing: "-0.01em", whiteSpace: "nowrap", opacity: barGrow }}>{name}</div>
          {title ? <div style={{ color: accent, fontWeight: 500, fontSize: nameSize * 0.52, marginTop: u * 0.6, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", opacity: interpolate(t.frame, [t.fps * 0.3, t.fps * 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{title}</div> : null}
        </div>
      </div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* EndCard                                                              */
/* ------------------------------------------------------------------ */

export const EndCard: React.FC<GraphicProps> = ({ props }) => {
  const t = useTiming({ exitMs: 400, damping: 15 });
  const u = unit(t.width, t.height);
  const headline = str(props, "headline", "Follow for more");
  const handle = str(props, "handle");
  const accent = color(props, "accent", "#FFD400");
  const background = color(props, "background", "#0B0B0F");
  const font = loadFontStack("anton");
  const sub = loadFontStack("inter");
  const pulse = 1 + Math.sin((t.frame / t.fps) * 3.2) * 0.025;
  const ringR = lerp(u * 20, u * 70, t.enter);
  const words = headline.split(/\s+/);
  const fontSize = clamp((t.width * 0.8) / Math.max(words.reduce((m, w) => Math.max(m, w.length), 1) * 0.5, 1), u * 8, u * 15);
  return (
    <Fill style={{ background, opacity: Math.min(1, t.enter * 1.4) * (1 - t.exit), alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", width: ringR * 2, height: ringR * 2, borderRadius: "50%", border: `${u * 0.5}px solid ${withAlpha(accent, 0.18)}`, left: t.width / 2 - ringR, top: t.height / 2 - ringR }} />
      <div style={{ position: "absolute", width: ringR * 1.4, height: ringR * 1.4, borderRadius: "50%", background: `radial-gradient(circle, ${withAlpha(accent, 0.22)} 0%, transparent 70%)`, left: t.width / 2 - ringR * 0.7, top: t.height / 2 - ringR * 0.7 }} />
      <div style={{ textAlign: "center", transform: `scale(${(lerp(0.8, 1, t.enter) * pulse).toFixed(3)})`, padding: `0 ${u * 6}px` }}>
        <div style={{ fontFamily: font, fontSize, color: "#fff", textTransform: "uppercase", lineHeight: 1, textShadow: `0 ${u}px ${u * 3}px rgba(0,0,0,0.6)`, letterSpacing: "0.01em" }}>{headline}</div>
        {handle ? (
          <div style={{ display: "inline-block", marginTop: u * 4, background: accent, color: luminance(accent) > 0.5 ? "#111" : "#fff", fontFamily: sub, fontWeight: 800, fontSize: u * 4.4, padding: `${u * 1.4}px ${u * 4}px`, borderRadius: 999, transform: `translateY(${lerp(u * 6, 0, t.enter).toFixed(1)}px)`, boxShadow: `0 ${u}px ${u * 3}px ${withAlpha(accent, 0.45)}` }}>
            {handle.startsWith("@") ? handle : `@${handle}`}
          </div>
        ) : null}
      </div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* ProgressBar                                                          */
/* ------------------------------------------------------------------ */

export const ProgressBar: React.FC<GraphicProps> = ({ props, absoluteFrame, totalFrames }) => {
  const t = useTiming({ exitMs: 1 });
  const position = oneOf(props, "position", ["top", "bottom"] as const, "top");
  const barColor = color(props, "color", "#FFD400");
  const thickness = num(props, "thickness", 8, 1, 200);
  const progress = clamp(absoluteFrame / Math.max(1, totalFrames - 1), 0, 1);
  return (
    <Fill>
      <div style={{ position: "absolute", left: 0, right: 0, [position]: 0, height: thickness, background: "rgba(0,0,0,0.35)" }}>
        <div style={{ width: `${(progress * 100).toFixed(3)}%`, height: "100%", background: barColor, boxShadow: `0 0 ${thickness * 1.5}px ${withAlpha(barColor, 0.6)}`, borderRadius: position === "top" ? `0 ${thickness / 2}px ${thickness / 2}px 0` : `0 ${thickness / 2}px ${thickness / 2}px 0`, opacity: Math.min(1, t.enter * 2) }} />
      </div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* SubscribeBubble                                                      */
/* ------------------------------------------------------------------ */

const PLATFORMS = ["youtube", "instagram", "tiktok", "generic"] as const;

const PlatformIcon: React.FC<{ platform: (typeof PLATFORMS)[number]; size: number }> = ({ platform, size }) => {
  const common = { width: size, height: size, viewBox: "0 0 24 24" } as const;
  switch (platform) {
    case "youtube":
      return (
        <svg {...common}>
          <rect x={2} y={5} width={20} height={14} rx={4} fill="#FF0000" />
          <path d="M10 9l5 3-5 3z" fill="#fff" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FFC107" />
              <stop offset="0.5" stopColor="#F44336" />
              <stop offset="1" stopColor="#9C27B0" />
            </linearGradient>
          </defs>
          <rect x={3} y={3} width={18} height={18} rx={5} fill="url(#ig)" />
          <circle cx={12} cy={12} r={4} fill="none" stroke="#fff" strokeWidth={2} />
          <circle cx={17} cy={7} r={1.2} fill="#fff" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <rect x={2} y={2} width={20} height={20} rx={5} fill="#000" />
          <path d="M13 6v8.2a2.3 2.3 0 1 1-2.3-2.3V9.6a4.6 4.6 0 1 0 4.6 4.6V10a4 4 0 0 0 2.5.9V8.6A2.8 2.8 0 0 1 15.2 6z" fill="#fff" />
          <path d="M13.6 6v8.2a2.3 2.3 0 1 1-2.3-2.3" fill="none" stroke="#25F4EE" strokeWidth={0.8} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 3a5 5 0 0 0-5 5v3.5L5 15v1h14v-1l-2-3.5V8a5 5 0 0 0-5-5z" fill="#fff" />
          <circle cx={12} cy={19} r={2} fill="#fff" />
        </svg>
      );
  }
};

export const SubscribeBubble: React.FC<GraphicProps> = ({ props }) => {
  const t = useTiming({ exitMs: 300, damping: 12, stiffness: 220 });
  const u = unit(t.width, t.height);
  const label = str(props, "label", "Follow");
  const platform = oneOf(props, "platform", PLATFORMS, "generic");
  const font = loadFontStack("inter");
  const clickAt = Math.round(t.fps * 0.9);
  const clicked = t.frame >= clickAt;
  const clickSpring = spring({ frame: Math.max(0, t.frame - clickAt), fps: t.fps, config: { damping: 10, stiffness: 300, mass: 0.6 } });
  const press = t.frame >= clickAt && t.frame < clickAt + t.fps * 0.25 ? 0.92 : 1;
  const pointerX = interpolate(t.frame, [t.fps * 0.2, clickAt], [u * 24, u * 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pointerY = interpolate(t.frame, [t.fps * 0.2, clickAt], [u * 22, u * 7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pointerOpacity = interpolate(t.frame, [t.fps * 0.15, t.fps * 0.4, clickAt + t.fps * 0.6, clickAt + t.fps * 0.9], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fontSize = u * 4.2;
  const bg = clicked ? (platform === "youtube" ? "#FF0000" : "#111") : "#fff";
  const fg = clicked ? "#fff" : "#111";
  const scale = lerp(0.4, 1, t.enter) * press * (1 - t.exit * 0.4);
  const ripple = clicked ? lerp(1, 2.4, clickSpring) : 0;
  return (
    <Fill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: t.height * (t.height > t.width ? 0.3 : 0.16) }}>
      <div style={{ position: "relative", transform: `scale(${scale.toFixed(3)})`, opacity: 1 - t.exit }}>
        {clicked ? <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: `${u * 0.4}px solid ${withAlpha("#ffffff", 0.7 * (1 - clickSpring))}`, transform: `scale(${ripple.toFixed(3)})` }} /> : null}
        <div style={{ display: "flex", alignItems: "center", gap: u * 1.6, background: bg, color: fg, fontFamily: font, fontWeight: 800, fontSize, padding: `${u * 1.6}px ${u * 3.4}px ${u * 1.6}px ${u * 2.4}px`, borderRadius: 999, boxShadow: `0 ${u * 1.2}px ${u * 3}px rgba(0,0,0,0.4)`, whiteSpace: "nowrap" }}>
          <PlatformIcon platform={platform} size={fontSize * 1.25} />
          <span>{clicked ? `${label}ed` : label}</span>
          {clicked ? (
            <svg width={fontSize} height={fontSize} viewBox="0 0 24 24" style={{ transform: `scale(${clickSpring.toFixed(3)})` }}>
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={fg} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </div>
        <svg width={u * 7} height={u * 7} viewBox="0 0 24 24" style={{ position: "absolute", left: `calc(50% + ${pointerX}px)`, top: `calc(50% + ${pointerY}px)`, opacity: pointerOpacity, filter: `drop-shadow(0 ${u * 0.4}px ${u}px rgba(0,0,0,0.5))`, transform: `scale(${press === 1 ? 1 : 0.85})` }}>
          <path d="M8 3v12.5l2.6-2.4L13 19l2.4-1-2.3-5.6H17z" fill="#fff" stroke="#111" strokeWidth={1.2} strokeLinejoin="round" />
        </svg>
      </div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* PointerHighlight                                                     */
/* ------------------------------------------------------------------ */

export const PointerHighlight: React.FC<GraphicProps> = ({ props }) => {
  const t = useTiming({ exitMs: 250, damping: 13 });
  const u = unit(t.width, t.height);
  const x = num(props, "x", 0.5, 0, 1) * t.width;
  const y = num(props, "y", 0.5, 0, 1) * t.height;
  const radius = num(props, "radius", 120, 10, Math.max(t.width, t.height));
  const ring = color(props, "color", "#FF4D6D");
  const label = str(props, "label");
  const font = loadFontStack("inter");
  const r = radius * lerp(2.2, 1, t.enter);
  const pulse = (t.frame / t.fps) % 1.2 / 1.2;
  const opacity = Math.min(1, t.enter * 1.5) * (1 - t.exit);
  const labelBelow = y < t.height * 0.75;
  return (
    <Fill style={{ opacity }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, rgba(0,0,0,0.42) ${r * 1.5}px)` }} />
      <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${Math.max(3, u * 0.7)}px solid ${ring}`, boxShadow: `0 0 ${u * 3}px ${withAlpha(ring, 0.7)}, inset 0 0 ${u * 2}px ${withAlpha(ring, 0.35)}` }} />
      <div style={{ position: "absolute", left: x - r * (1 + pulse * 0.6), top: y - r * (1 + pulse * 0.6), width: r * 2 * (1 + pulse * 0.6), height: r * 2 * (1 + pulse * 0.6), borderRadius: "50%", border: `${Math.max(2, u * 0.4)}px solid ${withAlpha(ring, (1 - pulse) * 0.8)}` }} />
      {label ? (
        <div style={{ position: "absolute", left: x, top: labelBelow ? y + r + u * 2.5 : y - r - u * 2.5, transform: `translate(-50%, ${labelBelow ? 0 : -100}%)`, background: ring, color: luminance(ring) > 0.5 ? "#111" : "#fff", fontFamily: font, fontWeight: 700, fontSize: u * 3.4, padding: `${u * 1}px ${u * 2.4}px`, borderRadius: 999, whiteSpace: "nowrap", boxShadow: `0 ${u * 0.6}px ${u * 2}px rgba(0,0,0,0.4)` }}>
          {label}
        </div>
      ) : null}
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* TextCallout                                                          */
/* ------------------------------------------------------------------ */

export const TextCallout: React.FC<GraphicProps> = ({ props }) => {
  const t = useTiming({ exitMs: 250, damping: 11, stiffness: 240 });
  const u = unit(t.width, t.height);
  const text = str(props, "text", "Wow!");
  const x = num(props, "x", 0.5, 0, 1) * t.width;
  const y = num(props, "y", 0.3, 0, 1) * t.height;
  const fg = color(props, "color", "#111111");
  const bg = color(props, "background", "#FFFFFF");
  const size = oneOf(props, "size", ["sm", "md", "lg"] as const, "md");
  const fontSize = u * (size === "sm" ? 3.6 : size === "lg" ? 7 : 5);
  const font = loadFontStack("poppins");
  const scale = lerp(0.3, 1, t.enter) * lerp(1, 0.7, t.exit);
  const tilt = lerp(-6, 0, t.enter);
  return (
    <Fill>
      <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${scale.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`, opacity: 1 - t.exit, background: bg, color: fg, fontFamily: font, fontWeight: 800, fontSize, lineHeight: 1.15, padding: `${fontSize * 0.35}px ${fontSize * 0.7}px`, borderRadius: fontSize * 0.7, maxWidth: t.width * 0.8, textAlign: "center", boxShadow: `0 ${u * 1}px ${u * 3}px rgba(0,0,0,0.35)` }}>
        {text}
      </div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* ImageOverlay                                                         */
/* ------------------------------------------------------------------ */

export const ImageOverlay: React.FC<GraphicProps> = ({ props, assets }) => {
  const t = useTiming({ exitMs: 300, damping: 13 });
  const u = unit(t.width, t.height);
  const assetId = str(props, "assetId");
  const asset = assetId ? assets[assetId] : undefined;
  const x = num(props, "x", 0.5, 0, 1) * t.width;
  const y = num(props, "y", 0.5, 0, 1) * t.height;
  const w = num(props, "width", 0.6, 0.05, 1) * t.width;
  const animation = oneOf(props, "animation", ["pop", "slide", "fade"] as const, "pop");
  const rounded = bool(props, "rounded", true);
  const ratio = asset?.width && asset?.height ? asset.height / asset.width : 0.66;
  const h = w * ratio;
  let transform = "translate(-50%, -50%)";
  let opacity = 1 - t.exit;
  if (animation === "pop") transform += ` scale(${(lerp(0.5, 1, t.enter) * lerp(1, 0.9, t.exit)).toFixed(3)})`;
  if (animation === "slide") transform += ` translateY(${lerp(t.height * 0.25, 0, t.enter).toFixed(1)}px)`;
  if (animation === "fade") opacity = Math.min(opacity, interpolate(t.frame, [0, t.fps * 0.35], [0, 1], { extrapolateRight: "clamp" }));
  if (animation !== "fade") opacity = Math.min(opacity, Math.min(1, t.enter * 2));
  return (
    <Fill>
      <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform, opacity, filter: `drop-shadow(0 ${u * 1.5}px ${u * 4}px rgba(0,0,0,0.45))` }}>
        <SafeImage asset={asset} rounded={rounded ? u * 2.4 : 0} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} label={asset?.name ?? assetId ?? "Image"} />
      </div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* LogoBug                                                              */
/* ------------------------------------------------------------------ */

export const LogoBug: React.FC<GraphicProps> = ({ props, assets }) => {
  const t = useTiming({ exitMs: 300 });
  const u = unit(t.width, t.height);
  const assetId = str(props, "assetId");
  const asset = assetId ? assets[assetId] : undefined;
  const corner = oneOf(props, "corner", ["tl", "tr", "bl", "br"] as const, "tr");
  const size = num(props, "size", 0.12, 0.02, 0.6) * t.width;
  const opacity = num(props, "opacity", 0.9, 0, 1);
  const margin = u * 4 + (t.height > t.width ? u * 6 : 0);
  const pos: React.CSSProperties = {
    [corner.startsWith("t") ? "top" : "bottom"]: margin,
    [corner.endsWith("l") ? "left" : "right"]: u * 4,
  };
  return (
    <Fill>
      <div style={{ position: "absolute", ...pos, width: size, opacity: opacity * Math.min(1, t.enter * 2) * (1 - t.exit), transform: `scale(${lerp(0.8, 1, t.enter).toFixed(3)})`, filter: `drop-shadow(0 ${u * 0.4}px ${u * 1.5}px rgba(0,0,0,0.45))` }}>
        <SafeImage asset={asset} rounded={u} style={{ width: "100%", height: "auto", display: "block", aspectRatio: asset?.width && asset.height ? `${asset.width} / ${asset.height}` : undefined }} label={asset?.name ?? "LOGO"} />
      </div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* ChapterCard                                                          */
/* ------------------------------------------------------------------ */

export const ChapterCard: React.FC<GraphicProps> = ({ props }) => {
  const t = useTiming({ exitMs: 350, damping: 15 });
  const u = unit(t.width, t.height);
  const number = str(props, "number", "01");
  const title = str(props, "title", "Chapter");
  const background = color(props, "background", "#0B0B0F");
  const accent = color(props, "accent", "#FFD400");
  const numFont = loadFontStack("anton");
  const titleFont = loadFontStack("inter");
  const wipe = interpolate(t.frame, [0, t.fps * 0.45], [0, 1], { extrapolateRight: "clamp" });
  const lineW = interpolate(t.frame, [t.fps * 0.2, t.fps * 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exitOpacity = 1 - t.exit;
  return (
    <Fill style={{ background, opacity: exitOpacity, clipPath: `inset(0 ${((1 - wipe) * 100).toFixed(2)}% 0 0)`, justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "absolute", fontFamily: numFont, fontSize: Math.min(t.width, t.height) * 0.72, color: withAlpha(accent, 0.12), lineHeight: 1, transform: `translateY(${lerp(u * 6, 0, t.enter).toFixed(1)}px)` }}>{number}</div>
      <div style={{ textAlign: "center", padding: `0 ${u * 6}px`, transform: `translateY(${lerp(u * 3, 0, t.enter).toFixed(1)}px)`, opacity: Math.min(1, t.enter * 1.5) }}>
        <div style={{ fontFamily: numFont, fontSize: u * 9, color: accent, letterSpacing: "0.1em", lineHeight: 1 }}>{number}</div>
        <div style={{ height: Math.max(3, u * 0.5), width: `${(lineW * 100).toFixed(1)}%`, maxWidth: u * 30, margin: `${u * 2.4}px auto`, background: accent, borderRadius: 999 }} />
        <div style={{ fontFamily: titleFont, fontWeight: 800, fontSize: clamp((t.width * 0.8) / Math.max(1, title.length * 0.55), u * 5, u * 10), color: "#fff", lineHeight: 1.1, letterSpacing: "-0.01em" }}>{title}</div>
      </div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* CountdownTimer                                                       */
/* ------------------------------------------------------------------ */

export const CountdownTimer: React.FC<GraphicProps> = ({ props }) => {
  const t = useTiming({ exitMs: 200 });
  const u = unit(t.width, t.height);
  const from = Math.max(1, Math.round(num(props, "from", 3, 1, 99)));
  const fg = color(props, "color", "#FFFFFF");
  const font = loadFontStack("anton");
  const per = Math.max(1, t.durationInFrames / from);
  const idx = Math.min(from - 1, Math.floor(t.frame / per));
  const local = t.frame - idx * per;
  const value = from - idx;
  const s = spring({ frame: local, fps: t.fps, config: { damping: 12, stiffness: 260, mass: 0.7 } });
  const fade = interpolate(local, [per * 0.7, per], [1, 0.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = u * 42;
  const ringR = u * 30;
  const circ = 2 * Math.PI * ringR;
  const dash = circ * (1 - local / per);
  return (
    <Fill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - t.exit }}>
      <svg width={ringR * 2 + u * 4} height={ringR * 2 + u * 4} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx={ringR + u * 2} cy={ringR + u * 2} r={ringR} fill="none" stroke={withAlpha(fg, 0.15)} strokeWidth={u * 1.2} />
        <circle cx={ringR + u * 2} cy={ringR + u * 2} r={ringR} fill="none" stroke={fg} strokeWidth={u * 1.2} strokeDasharray={circ} strokeDashoffset={circ - dash} strokeLinecap="round" />
      </svg>
      <div style={{ fontFamily: font, fontSize: size, color: fg, lineHeight: 1, transform: `scale(${lerp(1.8, 1, s).toFixed(3)})`, opacity: Math.min(1, s * 2) * fade, textShadow: `0 ${u}px ${u * 4}px rgba(0,0,0,0.6)` }}>{value}</div>
    </Fill>
  );
};

/* ------------------------------------------------------------------ */
/* SplitScreen                                                          */
/* ------------------------------------------------------------------ */

export const SplitScreen: React.FC<GraphicProps> = ({ props }) => {
  const t = useTiming({ exitMs: 300, damping: 15 });
  const u = unit(t.width, t.height);
  const a = str(props, "a", "Before");
  const b = str(props, "b", "After");
  const orientation = oneOf(props, "orientation", ["vertical", "horizontal"] as const, "vertical");
  const font = loadFontStack("inter");
  const fontSize = u * 4.4;
  const opacity = Math.min(1, t.enter * 1.6) * (1 - t.exit);
  const pill = (label: string, style: React.CSSProperties, dir: number): React.ReactNode => (
    <div style={{ position: "absolute", ...style, transform: `${style.transform ?? ""} translate${orientation === "vertical" ? "Y" : "X"}(${(lerp(dir * u * 8, 0, t.enter)).toFixed(1)}px)`, background: "rgba(10,10,14,0.75)", backdropFilter: "blur(10px)", color: "#fff", fontFamily: font, fontWeight: 800, fontSize, padding: `${u * 1.2}px ${u * 3}px`, borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", whiteSpace: "nowrap", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {label}
    </div>
  );
  const divider = orientation === "vertical"
    ? { left: 0, right: 0, top: t.height / 2 - u * 0.25, height: u * 0.5, transform: `scaleX(${t.enter.toFixed(3)})` }
    : { top: 0, bottom: 0, left: t.width / 2 - u * 0.25, width: u * 0.5, transform: `scaleY(${t.enter.toFixed(3)})` };
  return (
    <Fill style={{ opacity }}>
      <div style={{ position: "absolute", background: "rgba(255,255,255,0.85)", boxShadow: `0 0 ${u * 2}px rgba(0,0,0,0.5)`, ...divider }} />
      {orientation === "vertical"
        ? pill(a, { left: "50%", top: u * 5 + (t.height > t.width ? u * 8 : 0), transform: "translateX(-50%)" }, -1)
        : pill(a, { left: "25%", top: u * 5, transform: "translateX(-50%)" }, -1)}
      {orientation === "vertical"
        ? pill(b, { left: "50%", top: t.height / 2 + u * 5, transform: "translateX(-50%)" }, 1)
        : pill(b, { left: "75%", top: u * 5, transform: "translateX(-50%)" }, 1)}
    </Fill>
  );
};
