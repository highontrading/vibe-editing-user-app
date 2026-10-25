"use client";
import * as React from "react";
import { useEditor } from "@/lib/editor/store";
import { fmtTime } from "@/lib/editor/format";
import { RULER_H, startPointerDrag, useScale } from "./scale";

const STEPS = [100, 200, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000];

export function tickStep(zoom: number, minPx = 72): number {
  for (const s of STEPS) if ((s / 1000) * zoom >= minPx) return s;
  return STEPS[STEPS.length - 1]!;
}

export function Ruler({ durationMs, width, offsetLeft }: { durationMs: number; width: number; offsetLeft: number }) {
  const scale = useScale();
  const seek = useEditor((s) => s.seek);
  const step = tickStep(scale.zoom);
  const minor = step / (step >= 1000 ? 5 : 4);
  const ticks: { ms: number; major: boolean }[] = [];
  const total = Math.max(durationMs, scale.pxToMs(width));
  for (let ms = 0; ms <= total + step; ms += minor) ticks.push({ ms, major: Math.round(ms / minor) % Math.round(step / minor) === 0 });

  const seekFromEvent = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    seek(Math.max(0, scale.pxToMs(clientX - rect.left)));
  };

  return (
    <div
      className="sticky top-0 z-30 flex bg-bg"
      style={{ height: RULER_H }}
    >
      <div className="sticky left-0 z-40 shrink-0 border-b border-r border-border bg-bg" style={{ width: offsetLeft }} />
      <div
        className="relative flex-1 cursor-text select-none border-b border-border"
        onPointerDown={(e) => {
          const el = e.currentTarget;
          seekFromEvent(e.clientX, el);
          useEditor.getState().setPlaying(false);
          startPointerDrag(e, { onMove: (_dx, _dy, ev) => seekFromEvent(ev.clientX, el), onEnd: () => {} });
        }}
      >
        {ticks.map((t) => (
          <div key={t.ms} className="absolute bottom-0" style={{ left: scale.msToPx(t.ms) }}>
            <div className={t.major ? "h-2.5 w-px bg-muted/70" : "h-1.5 w-px bg-muted/30"} />
            {t.major && <span className="absolute bottom-3 left-1 whitespace-nowrap font-mono text-[9px] leading-none text-muted">{fmtTime(t.ms).replace(/\.0$/, "")}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
