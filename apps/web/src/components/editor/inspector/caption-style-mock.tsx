"use client";
import * as React from "react";
import type { CaptionStyleId } from "@vibe/edl";
import { cn } from "@/lib/utils";

/** CSS-only mock of each of the 12 caption styles for the gallery. */
export function CaptionStyleMock({ id, highlight = "#FFD400", className }: { id: CaptionStyleId; highlight?: string; className?: string }) {
  const base = "flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-[#15151c] px-2 text-center leading-none";
  const W = ({ children, hi, style }: { children: React.ReactNode; hi?: boolean; style?: React.CSSProperties }) => (
    <span style={{ color: hi ? highlight : undefined, ...style }}>{children}</span>
  );
  switch (id) {
    case "bold-pop":
      return <div className={cn(base, className)}><span className="text-[15px] font-black uppercase tracking-tight text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">LOOK <W hi>HERE</W></span></div>;
    case "clean-minimal":
      return <div className={cn(base, "items-end pb-2", className)}><span className="text-[10px] font-light text-white/90">a calm line of text</span></div>;
    case "hormozi":
      return <div className={cn(base, className)}><span className="text-[15px] font-black uppercase text-white [text-shadow:2px_2px_0_#000,-1px_-1px_0_#000]">GET <W style={{ color: "#3DFF6E" }}>RICH</W></span></div>;
    case "karaoke":
      return <div className={cn(base, "items-end pb-2", className)}><span className="text-[11px] font-semibold"><span style={{ color: "#FF4D6D" }}>sing al</span><span className="text-white/70">ong now</span></span></div>;
    case "typewriter":
      return <div className={cn(base, "items-end pb-2", className)}><span className="font-mono text-[10px] text-[#d7ffd7]">typing_<span className="animate-pulse">▍</span></span></div>;
    case "outline":
      return <div className={cn(base, "items-end pb-2", className)}><span className="text-[14px] font-black uppercase text-white [-webkit-text-stroke:1.5px_#000] [text-shadow:0_0_2px_#000]">BOLD</span></div>;
    case "glow":
      return <div className={cn(base, className)}><span className="rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-[#7CF0FF] [text-shadow:0_0_8px_#7CF0FF,0_0_16px_#7CF0FF]">neon glow</span></div>;
    case "boxed":
      return <div className={cn(base, "items-end pb-2", className)}><span className="bg-white px-1.5 py-0.5 text-[10px] font-bold text-black">in a box</span></div>;
    case "lower-third":
      return <div className={cn(base, "items-end pb-1.5", className)}><span className="w-full rounded-sm border-l-2 border-[#FFD400] bg-black/70 px-1.5 py-0.5 text-left text-[8px] font-medium text-white">Lower third caption</span></div>;
    case "two-line":
      return <div className={cn(base, "items-end pb-1.5", className)}><span className="text-[9px] font-semibold leading-[1.15] text-white/60">two centred<br /><span className="text-white">lines of text</span></span></div>;
    case "emoji-pop":
      return <div className={cn(base, className)}><span className="text-[13px] font-black uppercase text-white">WOW <span className="text-[14px]">🔥</span></span></div>;
    case "handwritten":
      return <div className={cn(base, "items-end pb-2", className)}><span className="rotate-[-3deg] font-display text-[13px] italic text-[#fff3d6]">diary day</span></div>;
  }
}
