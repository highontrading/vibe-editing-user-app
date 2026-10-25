import type { EditScript, VideoClip } from "@vibe/edl";
import { clipDuration } from "@vibe/edl";

/** Convert milliseconds on the output timeline to a (rounded) frame index. */
export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

export function framesToMs(frames: number, fps: number): number {
  return (frames / fps) * 1000;
}

/** Output-timeline duration of a video clip in frames (at least 1). */
export function clipDurationFrames(clip: VideoClip, fps: number): number {
  return Math.max(1, msToFrames(clipDuration(clip), fps));
}

export function scriptDurationFrames(script: EditScript): number {
  const fps = script.output.fps || 30;
  return Math.max(1, Math.ceil((script.output.durationMs / 1000) * fps));
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOutCubic = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeInCubic = (t: number): number => Math.pow(clamp(t, 0, 1), 3);
