"use client";
import * as React from "react";
import { ZoomIn, ZoomOut, Magnet, Scissors, Trash2, Copy, VolumeX, Volume2, HelpCircle, PanelBottomClose, Maximize, Film, MousePointer2 } from "lucide-react";
import { clipDuration, type Track } from "@vibe/edl";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/editor/format";
import { useEditor, useDisplayScript } from "@/lib/editor/store";
import { deleteSelection, duplicateSelection, selectionLabel, splitAtPlayhead, toggleMuteSelection } from "@/lib/editor/commands";
import { IconButton, PanelHeader } from "../panel";
import { ContextMenu, type MenuItem } from "./context-menu";
import { Ruler } from "./ruler";
import { LABEL_W, RULER_H, ScaleContext, makeScale, startPointerDrag } from "./scale";
import { TrackRow } from "./tracks";
import { TimelineUiContext, type MenuTarget } from "./timeline-ui";

/** Display order: graphics, captions, b-roll (top layer first), main video, then audio by role. */
function orderTracks(tracks: Track[]): Track[] {
  const gfx = tracks.filter((t) => t.kind === "graphics");
  const caps = tracks.filter((t) => t.kind === "captions");
  const broll = tracks.filter((t) => t.kind === "video" && t.layer > 0).sort((a, b) => (b.kind === "video" && a.kind === "video" ? b.layer - a.layer : 0));
  const main = tracks.filter((t) => t.kind === "video" && t.layer === 0);
  const roleOrder = { music: 0, sfx: 1, voice: 2, dialogue: 3 };
  const audio = tracks.filter((t) => t.kind === "audio").sort((a, b) => (a.kind === "audio" && b.kind === "audio" ? roleOrder[a.role] - roleOrder[b.role] : 0));
  return [...gfx, ...caps, ...broll, ...main, ...audio];
}

export function Timeline() {
  const script = useDisplayScript();
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const playheadMs = useEditor((s) => s.playheadMs);
  const playing = useEditor((s) => s.playing);
  const seek = useEditor((s) => s.seek);
  const selection = useEditor((s) => s.selection);
  const set = useEditor((s) => s.set);
  const [snap, setSnap] = React.useState(true);
  const [guide, setGuide] = React.useState<number | null>(null);
  const [menu, setMenu] = React.useState<{ x: number; y: number; target: MenuTarget } | null>(null);
  const [reason, setReason] = React.useState<{ x: number; y: number; title: string; text: string } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [viewportW, setViewportW] = React.useState(800);

  const scale = React.useMemo(() => makeScale(zoom), [zoom]);
  const duration = script?.output.durationMs ?? 0;
  const contentW = Math.max(viewportW - LABEL_W, scale.msToPx(duration) + 240);
  const tracks = React.useMemo(() => (script ? orderTracks(script.tracks) : []), [script]);

  // viewport size
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setViewportW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cmd/Ctrl + wheel zooms around the cursor (needs a non-passive listener)
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const st = useEditor.getState();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - LABEL_W + el.scrollLeft;
      const msAtCursor = (cursorX * 1000) / st.zoom;
      const factor = Math.exp(-e.deltaY * 0.0025);
      const next = Math.max(8, Math.min(600, st.zoom * factor));
      st.setZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = (msAtCursor * next) / 1000 - (e.clientX - rect.left - LABEL_W);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // follow the playhead while playing
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    const px = scale.msToPx(playheadMs);
    const visibleW = el.clientWidth - LABEL_W;
    if (px < el.scrollLeft || px > el.scrollLeft + visibleW - 40) el.scrollLeft = Math.max(0, px - visibleW * 0.2);
  }, [playheadMs, playing, scale]);

  const fitToView = () => {
    if (!duration) return;
    const el = scrollRef.current;
    const w = (el?.clientWidth ?? viewportW) - LABEL_W - 48;
    setZoom((w / duration) * 1000);
    if (el) el.scrollLeft = 0;
  };

  const ui = React.useMemo(() => ({ setGuide: (ms: number | null) => setGuide(snap ? ms : null), openClipMenu: (x: number, y: number, target: MenuTarget) => setMenu({ x, y, target }) }), [snap]);

  const menuItems = (target: MenuTarget): MenuItem[] => {
    const st = useEditor.getState();
    const items: MenuItem[] = [];
    const inside = target.kind === "clip" && st.playheadMs > target.clip.startMs && st.playheadMs < target.clip.startMs + clipDuration(target.clip);
    if (target.kind === "clip") items.push({ label: "Split at playhead", icon: Scissors, shortcut: "S", disabled: !inside, onClick: () => splitAtPlayhead() });
    items.push({ label: "Duplicate", icon: Copy, onClick: () => duplicateSelection() });
    if (target.kind === "clip") items.push({ label: target.clip.volume === 0 ? "Unmute clip" : "Mute clip", icon: target.clip.volume === 0 ? Volume2 : VolumeX, onClick: () => toggleMuteSelection() });
    if (target.kind === "audio") {
      const track = st.script?.tracks.find((t) => t.id === target.trackId);
      const muted = track?.kind === "audio" && track.muted;
      items.push({ label: muted ? "Unmute track" : "Mute track", icon: muted ? Volume2 : VolumeX, onClick: () => toggleMuteSelection() });
    }
    items.push({ label: "Go to start", icon: MousePointer2, onClick: () => seek(target.kind === "graphic" ? target.item.startMs : target.clip.startMs) });
    items.push({ separator: true, label: "" });
    const reasonText = target.kind === "graphic" ? target.item.reason : target.clip.reason;
    items.push({
      label: target.kind === "clip" ? "Why this cut?" : "Why is this here?",
      icon: HelpCircle,
      onClick: () => setReason({ x: menu?.x ?? 0, y: menu?.y ?? 0, title: target.kind === "graphic" ? target.item.component : (target.clip.label ?? "This clip"), text: reasonText ?? "No note from the editor for this one. Edits you make by hand have no reason attached." }),
    });
    items.push({ separator: true, label: "" });
    items.push({ label: "Delete", icon: Trash2, danger: true, shortcut: "⌫", onClick: () => deleteSelection() });
    return items;
  };

  if (!script) return null;
  const totalH = RULER_H + tracks.reduce((n, t) => n + (t.kind === "video" ? (t.layer === 0 ? 58 : 40) : t.kind === "audio" ? 36 : t.kind === "captions" ? 22 : 28) + 1, 0);

  return (
    <ScaleContext.Provider value={scale}>
      <TimelineUiContext.Provider value={ui}>
        <div className="flex h-full w-full flex-col bg-bg" onContextMenu={(e) => e.preventDefault()}>
          <PanelHeader
            title={
              <span className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5"><Film className="h-3 w-3" /> Timeline</span>
                <span className="font-mono text-[11px] normal-case tracking-normal text-fg">
                  {fmtTime(playheadMs, { frames: true, fps: script.output.fps })} <span className="text-muted">/ {fmtTime(duration, { frames: true, fps: script.output.fps })}</span>
                </span>
                {selection && <span className="rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-accent">{selectionLabel(script, selection)}</span>}
              </span>
            }
            right={
              <>
                <IconButton title="Snap to edges" active={snap} onClick={() => setSnap((s) => !s)}>
                  <Magnet className="h-3.5 w-3.5" />
                </IconButton>
                <div className="mx-1 flex items-center gap-1">
                  <IconButton title="Zoom out (-)" onClick={() => setZoom(zoom / 1.4)}>
                    <ZoomOut className="h-3.5 w-3.5" />
                  </IconButton>
                  <input type="range" min={Math.log(8)} max={Math.log(600)} step={0.01} value={Math.log(zoom)} onChange={(e) => setZoom(Math.exp(Number(e.target.value)))} className="vibe-range w-24" aria-label="Zoom" />
                  <IconButton title="Zoom in (+)" onClick={() => setZoom(zoom * 1.4)}>
                    <ZoomIn className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton title="Fit to window" onClick={fitToView}>
                    <Maximize className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
                <IconButton title="Collapse timeline ([)" onClick={() => set({ timelineOpen: false })}>
                  <PanelBottomClose className="h-3.5 w-3.5" />
                </IconButton>
              </>
            }
          />
          <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto" onPointerDown={(e) => e.target === e.currentTarget && useEditor.getState().select(null)}>
            <div className="relative" style={{ width: LABEL_W + contentW, minHeight: "100%" }}>
              <Ruler durationMs={duration} width={contentW} offsetLeft={LABEL_W} />
              {tracks.map((t) => (
                <TrackRow key={t.id} track={t} script={script} width={contentW} />
              ))}
              {/* end-of-edit shade */}
              <div className="pointer-events-none absolute bottom-0 right-0 bg-black/30" style={{ top: RULER_H, left: LABEL_W + scale.msToPx(duration), minHeight: totalH - RULER_H }} />
              {guide !== null && <div className="pointer-events-none absolute bottom-0 z-20 w-px border-l border-dashed border-accent-2" style={{ left: LABEL_W + scale.msToPx(guide), top: RULER_H }} />}
              <Playhead ms={playheadMs} totalH={Math.max(totalH, 200)} />
            </div>
          </div>
          {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.target)} onClose={() => setMenu(null)} />}
          {reason && <ReasonPopover {...reason} onClose={() => setReason(null)} />}
        </div>
      </TimelineUiContext.Provider>
    </ScaleContext.Provider>
  );
}

function Playhead({ ms, totalH }: { ms: number; totalH: number }) {
  const scale = React.useContext(ScaleContext);
  const seek = useEditor((s) => s.seek);
  const x = LABEL_W + scale.msToPx(ms);
  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const startMs = useEditor.getState().playheadMs;
    useEditor.getState().setPlaying(false);
    startPointerDrag(e, { onMove: (dx) => seek(startMs + scale.pxToMs(dx)), onEnd: () => {} });
  };
  return (
    <div className="pointer-events-none absolute top-0 z-10" style={{ left: x, height: totalH }}>
      <div className="absolute top-0 bottom-0 w-px -translate-x-1/2 bg-accent shadow-[0_0_6px_var(--color-accent)]" />
      <div
        className="pointer-events-auto absolute top-0 -translate-x-1/2 cursor-ew-resize"
        onPointerDown={onPointerDown}
        style={{ width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "12px solid var(--color-accent)" }}
      />
    </div>
  );
}

function ReasonPopover({ x, y, title, text, onClose }: { x: number; y: number; title: string; text: string; onClose: () => void }) {
  React.useEffect(() => {
    const down = () => onClose();
    const t = setTimeout(() => window.addEventListener("pointerdown", down), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", down);
    };
  }, [onClose]);
  return (
    <div className="fixed z-[95] w-72 rounded-lg border border-accent/30 bg-bg-2/95 p-3 shadow-2xl backdrop-blur" style={{ left: Math.min(x, window.innerWidth - 300), top: Math.min(y, window.innerHeight - 140) }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-accent"><HelpCircle className="h-3.5 w-3.5" /> {title}</div>
      <p className="text-xs leading-relaxed text-fg/90">{text}</p>
      <button type="button" onClick={onClose} className={cn("mt-2 text-[11px] text-muted hover:text-fg")}>Close</button>
    </div>
  );
}

