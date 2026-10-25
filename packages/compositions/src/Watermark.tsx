import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { loadFontStack } from "./fonts";

export const WATERMARK_TOKEN = "[watermark]";
export const WATERMARK_LABEL = "Made with Vibe";

/** Small semi-transparent badge in the bottom-right corner. */
export const Watermark: React.FC = () => {
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 100;
  const font = loadFontStack("inter");
  const fontSize = u * 2.6;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", justifyContent: "flex-end", alignItems: "flex-end", padding: `${u * 3}px ${u * 3.5}px` }}>
      <div style={{ display: "flex", alignItems: "center", gap: u * 1, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.85)", fontFamily: font, fontWeight: 700, fontSize, letterSpacing: "0.02em", padding: `${u * 0.9}px ${u * 1.8}px`, borderRadius: 999, backdropFilter: "blur(8px)" }}>
        <svg width={fontSize * 1.1} height={fontSize * 1.1} viewBox="0 0 24 24" fill="none">
          <path d="M12 2l2.2 6.3L21 10l-6.3 2.3L12 19l-2.7-6.7L3 10l6.8-1.7z" fill="#FFD400" />
        </svg>
        <span>{WATERMARK_LABEL}</span>
      </div>
    </AbsoluteFill>
  );
};
