import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AssetRef } from "@vibe/edl";
import { clamp } from "../lib/time";

export interface Timing {
  frame: number;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  /** 0 → 1 spring-eased entrance. */
  enter: number;
  /** 0 → 1 linear exit progress over the last `exitMs`. */
  exit: number;
  /** Convenience: 1 while fully on screen, fading to 0 during exit. */
  stay: number;
}

/** Entrance spring + exit ramp for a graphic rendered inside its own <Sequence>. */
export function useTiming(opts: { exitMs?: number; damping?: number; stiffness?: number; mass?: number } = {}): Timing {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const exitFrames = Math.min(Math.max(1, Math.round(((opts.exitMs ?? 320) / 1000) * fps)), Math.max(1, Math.floor(durationInFrames / 2)));
  const enter = spring({ frame, fps, config: { damping: opts.damping ?? 14, stiffness: opts.stiffness ?? 170, mass: opts.mass ?? 0.8 } });
  const exit = interpolate(frame, [durationInFrames - exitFrames, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { frame, fps, durationInFrames, width, height, enter, exit, stay: 1 - exit };
}

/** Relative unit: 1% of the shorter output edge, so graphics scale with 9:16 and 16:9 alike. */
export function unit(width: number, height: number): number {
  return Math.min(width, height) / 100;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp(t, 0, 1);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Small image with graceful fallback when the asset is missing or fails to load. */
export const SafeImage: React.FC<{ asset: AssetRef | undefined; style?: React.CSSProperties; label?: string; rounded?: number }> = ({ asset, style, label, rounded = 0 }) => {
  const [failed, setFailed] = React.useState(false);
  if (!asset || !asset.url || asset.kind !== "image" || failed) {
    return (
      <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#1c1e26,#2b2e3a)", color: "rgba(255,255,255,0.6)", fontFamily: "Inter, system-ui, sans-serif", fontWeight: 600, fontSize: 24, textAlign: "center", borderRadius: rounded, border: "2px dashed rgba(255,255,255,0.2)" }}>
        {label ?? asset?.name ?? "Image"}
      </div>
    );
  }
  return <Img src={asset.url} style={{ ...style, borderRadius: rounded }} onImageError={() => setFailed(true)} pauseWhenLoading />;
};

export const Fill: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ pointerEvents: "none", ...style }}>{children}</AbsoluteFill>
);
