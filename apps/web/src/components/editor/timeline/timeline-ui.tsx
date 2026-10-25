"use client";
import * as React from "react";
import type { AudioClip, GraphicItem, VideoClip } from "@vibe/edl";

export type MenuTarget = { kind: "clip"; clip: VideoClip; trackId: string } | { kind: "audio"; clip: AudioClip; trackId: string } | { kind: "graphic"; item: GraphicItem; trackId: string };

export interface TimelineUi {
  setGuide: (ms: number | null) => void;
  openClipMenu: (x: number, y: number, target: MenuTarget) => void;
}

export const TimelineUiContext = React.createContext<TimelineUi>({ setGuide: () => {}, openClipMenu: () => {} });
export const useTimelineUi = () => React.useContext(TimelineUiContext);
