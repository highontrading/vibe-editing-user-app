import React from "react";
import { AbsoluteFill } from "remotion";
import type { Effect, VideoClip } from "@vibe/edl";
import { gradeFor } from "../lib/colors";
import { num, str, type Rec } from "../lib/props";
import { handheldNoise } from "../lib/noise";
import { clamp, easeInOutCubic, lerp } from "../lib/time";

export interface ClipFx {
  /** CSS filter functions to apply to the footage. */
  filters: string[];
  /** Extra transform layered on top of the clip transform. */
  scale: number;
  x: number;
  y: number;
  rotate: number;
  /** Overlays drawn above the footage (grade tints, grain, vignette, light leak). */
  overlays: React.ReactNode[];
}

/**
 * Resolve the active window of an effect, in frames local to the clip.
 * `startMs`/`endMs` are output-timeline times (per the schema); when the window
 * does not intersect the clip at all we fall back to reading them as
 * clip-relative, which is what agents usually mean.
 */
export function effectWindow(effect: Effect, clipStartMs: number, clipDurMs: number, fps: number): { from: number; to: number } {
  const toFrame = (ms: number) => Math.round((ms / 1000) * fps);
  const durF = toFrame(clipDurMs);
  if (effect.startMs === undefined && effect.endMs === undefined) return { from: 0, to: durF };
  let s = effect.startMs ?? clipStartMs;
  let e = effect.endMs ?? clipStartMs + clipDurMs;
  const intersects = e > clipStartMs && s < clipStartMs + clipDurMs;
  if (!intersects && (effect.endMs ?? Infinity) <= clipDurMs) {
    s = clipStartMs + (effect.startMs ?? 0);
    e = clipStartMs + (effect.endMs ?? clipDurMs);
  }
  return { from: clamp(toFrame(s - clipStartMs), 0, durF), to: clamp(toFrame(e - clipStartMs), 0, durF) };
}

export function speedRampParams(clip: VideoClip): { from: number; to: number } | null {
  const fx = clip.effects.find((e) => e.type === "speedRamp");
  if (!fx) return null;
  const p = fx.params as Rec;
  const from = num(p, "from", 1, 0.1, 8);
  const to = num(p, "to", 1, 0.1, 8);
  if (Math.abs(from - to) < 0.001) return null;
  return { from, to };
}

/** Normalised source progress (0..1) for output progress t (0..1) under a linear speed ramp. */
export function rampProgress(t: number, from: number, to: number): number {
  const x = clamp(t, 0, 1);
  const distance = from * x + ((to - from) * x * x) / 2;
  const total = (from + to) / 2;
  return total > 0 ? distance / total : x;
}

const GRAIN_SEEDS = 7;
const grainTile = (seed: number, size = 220): string => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};
const GRAIN_TILES = Array.from({ length: GRAIN_SEEDS }, (_, i) => grainTile(i + 1));

export const GrainOverlay: React.FC<{ amount: number; frame: number }> = ({ amount, frame }) => {
  if (amount <= 0) return null;
  const idx = ((frame % GRAIN_SEEDS) + GRAIN_SEEDS) % GRAIN_SEEDS;
  const shiftX = (frame * 37) % 220;
  const shiftY = (frame * 53) % 220;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: GRAIN_TILES[idx],
        backgroundSize: "220px 220px",
        backgroundPosition: `${shiftX}px ${shiftY}px`,
        mixBlendMode: "overlay",
        opacity: clamp(amount, 0, 1) * 0.6,
        pointerEvents: "none",
      }}
    />
  );
};

export const VignetteOverlay: React.FC<{ amount: number }> = ({ amount }) => {
  if (amount <= 0) return null;
  const a = clamp(amount, 0, 1);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${lerp(70, 35, a)}%, rgba(0,0,0,${(0.55 + a * 0.4).toFixed(3)}) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
};

export const LightLeakOverlay: React.FC<{ intensity: number; progress: number; width: number; height: number }> = ({ intensity, progress, width, height }) => {
  if (intensity <= 0) return null;
  const e = easeInOutCubic(progress);
  const x = lerp(-0.7, 1.3, e) * width;
  const fade = Math.pow(Math.sin(clamp(progress, 0, 1) * Math.PI), 0.6);
  const size = Math.max(width, height) * 1.3;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: clamp(intensity, 0, 1) * 0.9 * fade, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: size,
          height: size,
          left: x - size / 2,
          top: height * 0.5 - size / 2 + Math.sin(e * Math.PI) * height * 0.15,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,170,90,0.95) 0%, rgba(255,90,70,0.55) 30%, rgba(255,40,120,0.2) 55%, rgba(0,0,0,0) 72%)",
          transform: `rotate(${lerp(-25, 25, e)}deg) scaleX(1.6)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Compute all per-clip effect state for one frame (pure; no hooks). */
export function computeClipFx(clip: VideoClip, localFrame: number, fps: number, durFrames: number, width: number, height: number, seed: string): ClipFx {
  const fx: ClipFx = { filters: [], scale: 1, x: 0, y: 0, rotate: 0, overlays: [] };
  const clipDurMs = (durFrames / fps) * 1000;
  const tSec = localFrame / fps;
  clip.effects.forEach((effect, i) => {
    const win = effectWindow(effect, clip.startMs, clipDurMs, fps);
    if (localFrame < win.from || localFrame >= win.to) return;
    const winLen = Math.max(1, win.to - win.from);
    const progress = (localFrame - win.from) / winLen;
    const p = effect.params as Rec;
    const key = `${effect.type}-${i}`;
    switch (effect.type) {
      case "colorGrade": {
        const grade = gradeFor(str(p, "preset"));
        if (grade.filter) fx.filters.push(grade.filter);
        grade.overlays.forEach((o, j) => fx.overlays.push(<AbsoluteFill key={`${key}-${j}`} style={{ ...o, pointerEvents: "none" }} />));
        break;
      }
      case "grain":
        fx.overlays.push(<GrainOverlay key={key} amount={num(p, "amount", 0.35, 0, 1)} frame={localFrame} />);
        break;
      case "vignette":
        fx.overlays.push(<VignetteOverlay key={key} amount={num(p, "amount", 0.5, 0, 1)} />);
        break;
      case "blur":
        fx.filters.push(`blur(${num(p, "px", 12, 0, 200)}px)`);
        break;
      case "lightLeak":
        fx.overlays.push(<LightLeakOverlay key={key} intensity={num(p, "intensity", 0.6, 0, 1)} progress={progress} width={width} height={height} />);
        break;
      case "shake": {
        const intensity = num(p, "intensity", 0.5, 0, 1);
        const amp = intensity * width * 0.025;
        fx.x += handheldNoise(`${seed}x`, tSec) * amp;
        fx.y += handheldNoise(`${seed}y`, tSec) * amp * 0.8;
        fx.rotate += handheldNoise(`${seed}r`, tSec) * intensity * 0.8;
        fx.scale *= 1 + intensity * 0.06;
        break;
      }
      case "zoomPulse": {
        const amount = num(p, "amount", 0.08, 0, 0.5);
        const bpm = num(p, "bpm", 120, 20, 300);
        const beat = (tSec * bpm) / 60;
        const phase = beat - Math.floor(beat);
        const pulse = Math.exp(-5 * phase);
        fx.scale *= 1 + amount * pulse;
        break;
      }
      case "speedRamp":
        // Time remapping is handled by ClipMedia; nothing visual here.
        break;
      default:
        break;
    }
  });
  return fx;
}
