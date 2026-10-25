import React from "react";
import { AbsoluteFill } from "remotion";
import type { TransitionType } from "@vibe/edl";
import { clamp, easeInOutCubic, easeOutCubic, lerp, smoothstep } from "../lib/time";
import { seeded } from "../lib/noise";

/** Per-frame visual state of one side of a transition. */
export interface TransitionVisual {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  /** Horizontal / vertical gaussian blur (px) for motion blur. */
  blurX: number;
  blurY: number;
  brightness: number;
  /** RGB-split magnitude in px (0 = none). */
  glitch: number;
}

export interface TransitionFrame {
  incoming: TransitionVisual;
  outgoing: TransitionVisual;
  /** Full-screen colour overlay (flash / dip-to-black). */
  overlay: { color: string; opacity: number } | null;
  /** Whether the previous clip's tail should be drawn at all this frame. */
  showOutgoing: boolean;
}

export const IDENTITY: TransitionVisual = { opacity: 1, translateX: 0, translateY: 0, scale: 1, blurX: 0, blurY: 0, brightness: 1, glitch: 0 };
const HIDDEN: TransitionVisual = { ...IDENTITY, opacity: 0 };

const vis = (partial: Partial<TransitionVisual>): TransitionVisual => ({ ...IDENTITY, ...partial });

/** Deterministic jitter in [-1,1] for glitch tearing. */
const jitter = (seed: string, frame: number, salt: string): number => seeded(seed, `${salt}:${frame}`) * 2 - 1;

/**
 * Transition between an outgoing clip (drawn underneath, continuing past its
 * out point) and the incoming clip on top. `p` runs 0 → 1 over the transition.
 */
export function boundaryTransition(type: TransitionType, p: number, width: number, height: number, seed: string, frame: number): TransitionFrame {
  const t = clamp(p, 0, 1);
  switch (type) {
    case "cut":
      return { incoming: IDENTITY, outgoing: IDENTITY, overlay: null, showOutgoing: false };
    case "crossfade":
      return { incoming: vis({ opacity: smoothstep(t) }), outgoing: IDENTITY, overlay: null, showOutgoing: t < 1 };
    case "dip-to-black": {
      const first = t < 0.5;
      const o = first ? smoothstep(t * 2) : smoothstep((1 - t) * 2);
      return { incoming: first ? HIDDEN : IDENTITY, outgoing: IDENTITY, overlay: { color: "#000", opacity: o }, showOutgoing: first };
    }
    case "whip": {
      const e = easeInOutCubic(t);
      const blur = Math.sin(t * Math.PI) * width * 0.08;
      return {
        incoming: vis({ translateX: (1 - e) * width, blurX: blur, scale: 1.04 - 0.04 * e }),
        outgoing: vis({ translateX: -e * width, blurX: blur, scale: 1.04 }),
        overlay: null,
        showOutgoing: t < 1,
      };
    }
    case "zoom": {
      const e = easeInOutCubic(t);
      const mid = Math.sin(t * Math.PI);
      return {
        incoming: vis({ opacity: smoothstep((t - 0.25) / 0.5), scale: lerp(1.7, 1, easeOutCubic(t)), blurX: mid * 14, blurY: mid * 14 }),
        outgoing: vis({ scale: 1 + e * 0.9, blurX: mid * 14, blurY: mid * 14, brightness: 1 + mid * 0.4 }),
        overlay: null,
        showOutgoing: t < 0.75,
      };
    }
    case "slide": {
      const e = easeInOutCubic(t);
      return {
        incoming: vis({ translateX: (1 - e) * width }),
        outgoing: vis({ translateX: -e * width * 0.35, brightness: 1 - e * 0.5 }),
        overlay: null,
        showOutgoing: t < 1,
      };
    }
    case "flash": {
      const rise = 0.3;
      const o = t < rise ? easeOutCubic(t / rise) : 1 - easeInOutCubic((t - rise) / (1 - rise));
      return { incoming: t < rise ? HIDDEN : IDENTITY, outgoing: IDENTITY, overlay: { color: "#fff", opacity: o }, showOutgoing: t < rise };
    }
    case "glitch": {
      const amp = (1 - easeOutCubic(t)) * width * 0.03;
      const j = jitter(seed, frame, "g");
      const swap = t < 0.45 && seeded(seed, `swap:${frame}`) > 0.55;
      return {
        incoming: vis({ opacity: swap ? 0 : 1, glitch: amp * (0.6 + Math.abs(j)), translateX: j * amp * 0.5 }),
        outgoing: vis({ glitch: amp, translateX: -j * amp * 0.5, brightness: 1.1 }),
        overlay: null,
        showOutgoing: t < 0.45,
      };
    }
    default:
      return { incoming: IDENTITY, outgoing: IDENTITY, overlay: null, showOutgoing: false };
  }
}

/** A clip entering from the background (no previous clip to transition from). */
export function enterTransition(type: TransitionType, p: number, width: number, height: number, seed: string, frame: number): { visual: TransitionVisual; overlay: TransitionFrame["overlay"] } {
  const t = clamp(p, 0, 1);
  switch (type) {
    case "crossfade":
      return { visual: vis({ opacity: smoothstep(t) }), overlay: null };
    case "dip-to-black":
      return { visual: IDENTITY, overlay: { color: "#000", opacity: 1 - smoothstep(t) } };
    case "zoom":
      return { visual: vis({ opacity: smoothstep(t * 2), scale: lerp(1.6, 1, easeOutCubic(t)), blurX: (1 - t) * 10, blurY: (1 - t) * 10 }), overlay: null };
    default: {
      const b = boundaryTransition(type, t, width, height, seed, frame);
      return { visual: b.incoming, overlay: b.overlay };
    }
  }
}

/** A clip leaving to the background (no next clip to transition to). */
export function exitTransition(type: TransitionType, p: number, width: number, height: number, seed: string, frame: number): { visual: TransitionVisual; overlay: TransitionFrame["overlay"] } {
  const t = clamp(p, 0, 1);
  switch (type) {
    case "cut":
      return { visual: IDENTITY, overlay: null };
    case "crossfade":
      return { visual: vis({ opacity: 1 - smoothstep(t) }), overlay: null };
    case "dip-to-black":
      return { visual: IDENTITY, overlay: { color: "#000", opacity: smoothstep(t) } };
    case "flash":
      return { visual: IDENTITY, overlay: { color: "#fff", opacity: easeInOutCubic(t) } };
    default: {
      const b = boundaryTransition(type, t, width, height, seed, frame);
      // Fade the lone clip out towards the end so it does not pop to background.
      return { visual: { ...b.outgoing, opacity: b.outgoing.opacity * (1 - smoothstep((t - 0.6) / 0.4)) }, overlay: b.overlay };
    }
  }
}

export const TransitionOverlay: React.FC<{ overlay: TransitionFrame["overlay"] }> = ({ overlay }) => {
  if (!overlay || overlay.opacity <= 0.001) return null;
  return <AbsoluteFill style={{ backgroundColor: overlay.color, opacity: clamp(overlay.opacity, 0, 1), pointerEvents: "none" }} />;
};

/** SVG filter definitions used by glitch (channel isolation) and motion blur. */
export const ChannelFilters: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
    <defs>
      <filter id="vibe-chan-r" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
      </filter>
      <filter id="vibe-chan-gb" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />
      </filter>
    </defs>
  </svg>
);

export const MotionBlurFilter: React.FC<{ id: string; x: number; y: number }> = ({ id, x, y }) => (
  <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
    <defs>
      <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={`${Math.max(0, x).toFixed(2)} ${Math.max(0, y).toFixed(2)}`} edgeMode="duplicate" />
      </filter>
    </defs>
  </svg>
);

/** Horizontal tear bands for the glitch look, as a clip-path polygon string. */
export function glitchBands(seed: string, frame: number, salt: string, height: number): string {
  const bands: string[] = [];
  const count = 3;
  for (let i = 0; i < count; i++) {
    const y = seeded(seed, `${salt}:y${i}:${frame}`) * height;
    const h = (0.03 + seeded(seed, `${salt}:h${i}:${frame}`) * 0.12) * height;
    bands.push(`0px ${y}px, 100% ${y}px, 100% ${y + h}px, 0px ${y + h}px, 0px ${y}px`);
  }
  // A polygon made of disjoint rectangles chained through the origin.
  return `polygon(${bands.join(", ")})`;
}
