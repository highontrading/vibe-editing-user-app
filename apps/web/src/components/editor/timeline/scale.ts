"use client";
import * as React from "react";

export const LABEL_W = 132;
export const RULER_H = 24;
export const TRACK_H = { graphics: 28, captions: 22, broll: 40, main: 58, audio: 36 } as const;

export interface Scale {
  zoom: number; // px per second
  msToPx: (ms: number) => number;
  pxToMs: (px: number) => number;
}

export function makeScale(zoom: number): Scale {
  const pxPerMs = zoom / 1000;
  return { zoom, msToPx: (ms) => ms * pxPerMs, pxToMs: (px) => px / pxPerMs };
}

export function snapMs(ms: number, candidates: number[], thresholdMs: number): { ms: number; snapped: number | null } {
  let best: number | null = null;
  let bestDist = thresholdMs;
  for (const c of candidates) {
    const d = Math.abs(c - ms);
    if (d <= bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best === null ? { ms, snapped: null } : { ms: best, snapped: best };
}

export interface DragHandlers {
  onStart?: () => void;
  onMove: (dxPx: number, dyPx: number, ev: PointerEvent) => void;
  onEnd: (dxPx: number, dyPx: number, ev: PointerEvent, dragged: boolean) => void;
}

/** Pointer drag with a 3px click threshold. Returns a cleanup. */
export function startPointerDrag(e: React.PointerEvent, h: DragHandlers) {
  const startX = e.clientX;
  const startY = e.clientY;
  let dragged = false;
  let dx = 0;
  let dy = 0;
  const move = (ev: PointerEvent) => {
    dx = ev.clientX - startX;
    dy = ev.clientY - startY;
    if (!dragged && Math.hypot(dx, dy) > 3) {
      dragged = true;
      h.onStart?.();
    }
    if (dragged) h.onMove(dx, dy, ev);
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    h.onEnd(dx, dy, ev, dragged);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

export const ScaleContext = React.createContext<Scale>(makeScale(60));
export const useScale = () => React.useContext(ScaleContext);
