import type { ColorPreset } from "@vibe/edl";
import type React from "react";

export interface GradeDef {
  /** CSS filter stack applied to the footage. */
  filter: string;
  /** Optional tinted overlays blended over the footage. */
  overlays: React.CSSProperties[];
}

const none: GradeDef = { filter: "", overlays: [] };

export const COLOR_GRADES: Record<ColorPreset, GradeDef> = {
  none,
  "warm-film": {
    filter: "sepia(0.22) saturate(1.18) contrast(1.04) brightness(1.03)",
    overlays: [
      { background: "linear-gradient(180deg, rgba(255,166,77,0.16), rgba(255,110,70,0.1))", mixBlendMode: "soft-light" },
      { background: "rgba(40,20,10,0.08)", mixBlendMode: "lighten" },
    ],
  },
  clean: { filter: "contrast(1.06) brightness(1.05) saturate(1.06)", overlays: [] },
  moody: {
    filter: "saturate(0.72) contrast(1.18) brightness(0.9)",
    overlays: [
      { background: "linear-gradient(180deg, rgba(20,40,80,0.25), rgba(10,20,40,0.35))", mixBlendMode: "multiply" },
      { background: "rgba(40,60,110,0.18)", mixBlendMode: "screen" },
    ],
  },
  vibrant: { filter: "saturate(1.55) contrast(1.12) brightness(1.02)", overlays: [] },
  bw: { filter: "grayscale(1) contrast(1.25) brightness(1.02)", overlays: [] },
  "teal-orange": {
    filter: "saturate(1.15) contrast(1.1)",
    overlays: [
      { background: "rgba(0,120,140,0.28)", mixBlendMode: "lighten" },
      { background: "rgba(255,140,40,0.22)", mixBlendMode: "multiply" },
      { background: "linear-gradient(180deg, rgba(255,150,60,0.12), rgba(0,90,120,0.12))", mixBlendMode: "overlay" },
    ],
  },
};

export function gradeFor(preset: string | undefined): GradeDef {
  if (!preset) return none;
  return (COLOR_GRADES as Record<string, GradeDef>)[preset] ?? none;
}
