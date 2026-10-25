"use client";
import * as React from "react";
import { Film, Music, Volume2, VolumeX, Mic2, MessageSquareText, Shapes, Captions, CaptionsOff, Gauge, Layers, Infinity as InfinityIcon } from "lucide-react";
import { clipDuration, type AudioClip, type EditScript, type GraphicItem, type Track, type VideoClip, type VideoTrack, type AudioTrack, type GraphicsTrack, type CaptionTrack } from "@vibe/edl";
import { cn } from "@/lib/utils";
import { assetColor, clamp, fmtShort } from "@/lib/editor/format";
import { useEditor } from "@/lib/editor/store";
import { LABEL_W, TRACK_H, snapMs, startPointerDrag, useScale } from "./scale";
import { useTimelineUi } from "./timeline-ui";

const MIN_CLIP_MS = 120;

export function snapCandidates(script: EditScript, exclude: string | null, playheadMs: number): number[] {
  const out = [0, playheadMs, script.output.durationMs];
  for (const t of script.tracks) {
    if (t.kind === "video") for (const c of t.clips) if (c.id !== exclude) out.push(c.startMs, c.startMs + clipDuration(c));
    if (t.kind === "graphics") for (const g of t.items) if (g.id !== exclude) out.push(g.startMs, g.startMs + g.durationMs);
    if (t.kind === "audio") for (const c of t.clips) if (c.id !== exclude) out.push(c.startMs);
  }
  return out;
}

/**
 * Main-track clips are packed by `ripple()` (sorted by startMs, stable). A single
 * `moveClip` therefore cannot place a clip before the clip already at 0. To reorder we
 * decide the target index from the drop position and emit one `moveClip` per clip, each
 * to a start beyond the end, in the desired order: the result is deterministic on both
 * the client and the server. If the order does not change, nothing is emitted.
 */
export function reorderOps(script: EditScript, trackId: string, clipId: string, dropStartMs: number): import("@vibe/edl").EditOp[] {
  const track = script.tracks.find((t) => t.id === trackId);
  if (!track || track.kind !== "video") return [];
  const ordered = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  const dragged = ordered.find((c) => c.id === clipId);
  if (!dragged) return [];
  const others = ordered.filter((c) => c.id !== clipId);
  // insertion index: before the first clip whose midpoint lies after the dropped clip's left edge
  let cursor = 0;
  let index = others.length;
  for (let i = 0; i < others.length; i++) {
    const d = clipDuration(others[i]!);
    if (dropStartMs < cursor + d / 2) {
      index = i;
      break;
    }
    cursor += d;
  }
  const desired = [...others.slice(0, index), dragged, ...others.slice(index)];
  if (desired.every((c, i) => c.id === ordered[i]!.id)) return [];
  const beyond = ordered.reduce((n, c) => n + clipDuration(c), 0) + 1000;
  return desired.map((c) => ({ op: "moveClip" as const, clipId: c.id, startMs: beyond }));
}

/* ------------------------------------------------------------------ */
/* Track rows                                                           */
/* ------------------------------------------------------------------ */

/** Overlapping graphics stack into lanes so every pill stays readable. */
export function graphicLanes(items: GraphicItem[], durationMs: number): Map<string, number> {
  const lanes: number[] = [];
  const out = new Map<string, number>();
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs || b.durationMs - a.durationMs);
  for (const g of sorted) {
    const end = g.durationMs === 0 ? Math.max(durationMs, g.startMs + 1) : g.startMs + g.durationMs;
    let lane = lanes.findIndex((laneEnd) => laneEnd <= g.startMs);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(end);
    } else lanes[lane] = end;
    out.set(g.id, lane);
  }
  return out;
}

export function trackHeight(track: Track, script: EditScript): number {
  if (track.kind === "video") return track.layer === 0 ? TRACK_H.main : TRACK_H.broll;
  if (track.kind === "audio") return TRACK_H.audio;
  if (track.kind === "captions") return TRACK_H.captions;
  const lanes = Math.max(1, new Set(graphicLanes(track.items, script.output.durationMs).values()).size);
  return TRACK_H.graphics + (lanes - 1) * 22;
}

export function TrackRow({ track, script, width }: { track: Track; script: EditScript; width: number }) {
  const height = trackHeight(track, script);
  const lanes = React.useMemo(() => (track.kind === "graphics" ? graphicLanes(track.items, script.output.durationMs) : null), [track, script.output.durationMs]);
  return (
    <div className="flex border-b border-border/70" style={{ height, width: LABEL_W + width }}>
      <TrackLabel track={track} />
      <div className="relative flex-1 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.015),transparent)]" style={{ width }} onPointerDown={(e) => e.button === 0 && e.target === e.currentTarget && useEditor.getState().select(null)}>
        {track.kind === "video" && track.clips.map((c) => <VideoClipBlock key={c.id} clip={c} track={track} script={script} />)}
        {track.kind === "audio" && track.clips.map((c) => <AudioClipBlock key={c.id} clip={c} track={track} script={script} />)}
        {track.kind === "graphics" && track.items.map((g) => <GraphicBlock key={g.id} item={g} track={track} script={script} lane={lanes?.get(g.id) ?? 0} />)}
        {track.kind === "captions" && <CaptionWords track={track} />}
      </div>
    </div>
  );
}

function TrackLabel({ track }: { track: Track }) {
  const applyOps = useEditor((s) => s.applyOps);
  const captionsSelected = useEditor((s) => s.selection?.kind === "captions");
  const select = useEditor((s) => s.select);
  let icon: React.ReactNode;
  let name: string;
  let right: React.ReactNode = null;
  if (track.kind === "video") {
    icon = track.layer === 0 ? <Film className="h-3 w-3" /> : <Layers className="h-3 w-3" />;
    name = track.name ?? (track.layer === 0 ? "Video" : `B-roll ${track.layer}`);
  } else if (track.kind === "audio") {
    icon = track.role === "music" ? <Music className="h-3 w-3" /> : track.role === "voice" || track.role === "dialogue" ? <Mic2 className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />;
    name = track.name ?? track.role;
    right = (
      <button type="button" title={track.muted ? "Unmute track" : "Mute track"} onClick={() => applyOps([{ op: "setTrackMuted", trackId: track.id, muted: !track.muted }], track.muted ? "Unmute track" : "Mute track")} className={cn("rounded p-0.5 hover:bg-white/10", track.muted ? "text-danger" : "text-muted")}>
        {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      </button>
    );
  } else if (track.kind === "captions") {
    icon = <MessageSquareText className="h-3 w-3" />;
    name = "Captions";
    right = (
      <button type="button" title={track.enabled ? "Turn captions off" : "Turn captions on"} onClick={() => applyOps([{ op: "setCaptionsEnabled", enabled: !track.enabled }], track.enabled ? "Captions off" : "Captions on")} className={cn("rounded p-0.5 hover:bg-white/10", track.enabled ? "text-muted" : "text-danger")}>
        {track.enabled ? <Captions className="h-3 w-3" /> : <CaptionsOff className="h-3 w-3" />}
      </button>
    );
  } else {
    icon = <Shapes className="h-3 w-3" />;
    name = "Graphics";
  }
  return (
    <div
      className={cn("sticky left-0 z-20 flex shrink-0 items-center justify-between gap-1 border-r border-border bg-bg px-2 text-[11px]", track.kind === "captions" && captionsSelected && "bg-accent/10")}
      style={{ width: LABEL_W }}
      onClick={() => track.kind === "captions" && select({ kind: "captions", id: "captions" })}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-muted">
        {icon}
        <span className="truncate capitalize text-fg/90">{name}</span>
      </span>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Video clip                                                           */
/* ------------------------------------------------------------------ */

type Ghost = { startMs: number; durMs: number } | null;

function useThumb(assetId: string, script: EditScript) {
  return useEditor((s) => {
    const ref = script.assets[assetId];
    const a = s.project?.assets.find((x) => x.id === assetId) ?? s.project?.assets.find((x) => ref && (x.name === ref.name || x.url === ref.url));
    return a?.thumbUrl ?? null;
  });
}

function VideoClipBlock({ clip, track, script }: { clip: VideoClip; track: VideoTrack; script: EditScript }) {
  const scale = useScale();
  const ui = useTimelineUi();
  const selected = useEditor((s) => s.selection?.kind === "clip" && s.selection.id === clip.id);
  const [ghost, setGhost] = React.useState<Ghost>(null);
  const [hoverEdge, setHoverEdge] = React.useState<"l" | "r" | null>(null);
  const dur = clipDuration(clip);
  const asset = script.assets[clip.assetId];
  const thumb = useThumb(clip.assetId, script);
  const startMs = ghost?.startMs ?? clip.startMs;
  const durMs = ghost?.durMs ?? dur;
  const left = scale.msToPx(startMs);
  const width = Math.max(2, scale.msToPx(durMs));
  const color = assetColor(clip.assetId);
  const isMain = track.layer === 0;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const edge = rect.width > 24 ? 8 : rect.width / 4;
    const mode: "move" | "trim-left" | "trim-right" = x < edge ? "trim-left" : x > rect.width - edge ? "trim-right" : "move";
    const st = useEditor.getState();
    if (!st.script) return;
    const candidates = snapCandidates(st.script, clip.id, st.playheadMs);
    const thr = scale.pxToMs(8);
    const speed = clip.speed || 1;
    const maxSourceMs = asset?.durationMs;
    let result: { startMs: number; inMs: number; outMs: number } = { startMs: clip.startMs, inMs: clip.inMs, outMs: clip.outMs };
    startPointerDrag(e, {
      onStart: () => st.select({ kind: "clip", id: clip.id, trackId: track.id }),
      onMove: (dx) => {
        const dms = scale.pxToMs(dx);
        if (mode === "move") {
          let start = Math.max(0, clip.startMs + dms);
          const s1 = snapMs(start, candidates, thr);
          const s2 = snapMs(start + dur, candidates, thr);
          if (s1.snapped !== null) {
            start = s1.ms;
            ui.setGuide(s1.ms);
          } else if (s2.snapped !== null) {
            start = s2.ms - dur;
            ui.setGuide(s2.ms);
          } else ui.setGuide(null);
          start = Math.max(0, Math.round(start));
          result = { ...result, startMs: start };
          setGhost({ startMs: start, durMs: dur });
        } else if (mode === "trim-left") {
          const minStart = clip.startMs - clip.inMs / speed;
          const maxStart = clip.startMs + dur - MIN_CLIP_MS;
          let newStart = clamp(clip.startMs + dms, minStart, maxStart);
          const s = snapMs(newStart, candidates, thr);
          if (s.snapped !== null && s.ms >= minStart && s.ms <= maxStart) {
            newStart = s.ms;
            ui.setGuide(s.ms);
          } else ui.setGuide(null);
          const newIn = Math.max(0, Math.round(clip.inMs + (newStart - clip.startMs) * speed));
          result = { ...result, inMs: newIn, startMs: isMain ? clip.startMs : Math.round(newStart) };
          setGhost({ startMs: isMain ? clip.startMs : newStart, durMs: dur - (newStart - clip.startMs) });
        } else {
          const minEnd = clip.startMs + MIN_CLIP_MS;
          const maxEnd = maxSourceMs ? clip.startMs + (maxSourceMs - clip.inMs) / speed : Infinity;
          let newEnd = clamp(clip.startMs + dur + dms, minEnd, maxEnd);
          const s = snapMs(newEnd, candidates, thr);
          if (s.snapped !== null && s.ms >= minEnd && s.ms <= maxEnd) {
            newEnd = s.ms;
            ui.setGuide(s.ms);
          } else ui.setGuide(null);
          const newOut = Math.round(clip.inMs + (newEnd - clip.startMs) * speed);
          result = { ...result, outMs: newOut };
          setGhost({ startMs: clip.startMs, durMs: newEnd - clip.startMs });
        }
      },
      onEnd: (_dx, _dy, _ev, dragged) => {
        ui.setGuide(null);
        setGhost(null);
        const s = useEditor.getState();
        if (!dragged) {
          s.select({ kind: "clip", id: clip.id, trackId: track.id });
          return;
        }
        if (mode === "move") {
          if (result.startMs === clip.startMs) return;
          if (isMain && s.script) s.applyOps(reorderOps(s.script, track.id, clip.id, result.startMs), "Move clip");
          else s.applyOps([{ op: "moveClip", clipId: clip.id, startMs: result.startMs }], "Move clip");
        } else if (mode === "trim-left") {
          if (result.inMs !== clip.inMs) {
            const ops: import("@vibe/edl").EditOp[] = [{ op: "trimClip", clipId: clip.id, inMs: result.inMs }];
            if (!isMain && result.startMs !== clip.startMs) ops.push({ op: "moveClip", clipId: clip.id, startMs: result.startMs });
            s.applyOps(ops, "Trim clip");
          }
        } else if (result.outMs !== clip.outMs) {
          s.applyOps([{ op: "trimClip", clipId: clip.id, outMs: result.outMs }], "Trim clip");
        }
      },
    });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    useEditor.getState().select({ kind: "clip", id: clip.id, trackId: track.id });
    ui.openClipMenu(e.clientX, e.clientY, { kind: "clip", clip, trackId: track.id });
  };

  const name = clip.label ?? asset?.name ?? clip.assetId;
  const showText = width > 56;
  return (
    <div
      className={cn(
        "group absolute top-1 bottom-1 select-none overflow-hidden rounded-[5px] border text-[10px] leading-none transition-shadow",
        selected ? "z-10 border-accent shadow-[0_0_0_1px_var(--color-accent)]" : "border-black/40 hover:border-white/30",
        ghost && "opacity-90",
      )}
      style={{ left, width, backgroundColor: color, cursor: hoverEdge ? "ew-resize" : ghost ? "grabbing" : "grab" }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onPointerMove={(e) => {
        if (ghost) return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - r.left;
        const edge = r.width > 24 ? 8 : r.width / 4;
        setHoverEdge(x < edge ? "l" : x > r.width - edge ? "r" : null);
      }}
      onPointerLeave={() => setHoverEdge(null)}
      title={`${name} · ${fmtShort(dur)}${clip.reason ? `\n${clip.reason}` : ""}`}
      data-clip-id={clip.id}
    >
      {thumb ? (
        <div className="absolute inset-0 opacity-80" style={{ backgroundImage: `url(${thumb})`, backgroundRepeat: "repeat-x", backgroundSize: "auto 100%" }} />
      ) : (
        <div className="absolute inset-0 opacity-40 [background-image:repeating-linear-gradient(90deg,rgba(0,0,0,0.35)_0_1px,transparent_1px_26px)]" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
      {showText && (
        <div className="absolute inset-x-1.5 bottom-1 flex items-center justify-between gap-1 text-white drop-shadow">
          <span className="truncate font-medium">{name}</span>
          <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] opacity-80">
            {clip.volume === 0 && <VolumeX className="h-2.5 w-2.5" />}
            {clip.speed !== 1 && (
              <span className="inline-flex items-center gap-0.5"><Gauge className="h-2.5 w-2.5" />{clip.speed}×</span>
            )}
            {fmtShort(dur)}
          </span>
        </div>
      )}
      {clip.transitionIn && clip.transitionIn.type !== "cut" && <span className="absolute left-0 top-0 h-full w-1 bg-accent-2/80" title={`In: ${clip.transitionIn.type}`} />}
      {clip.transitionOut && clip.transitionOut.type !== "cut" && <span className="absolute right-0 top-0 h-full w-1 bg-accent-2/80" title={`Out: ${clip.transitionOut.type}`} />}
      {clip.effects.length > 0 && showText && <span className="absolute left-1.5 top-1 rounded bg-black/50 px-1 py-0.5 text-[8px] uppercase tracking-wider text-white/80">{clip.effects.length} fx</span>}
      {/* trim handles */}
      <div className={cn("absolute inset-y-0 left-0 w-2 opacity-0 transition-opacity group-hover:opacity-100", (hoverEdge === "l" || selected) && "opacity-100")}>
        <div className="mx-auto mt-[35%] h-[30%] w-[3px] rounded-full bg-white/80" />
      </div>
      <div className={cn("absolute inset-y-0 right-0 w-2 opacity-0 transition-opacity group-hover:opacity-100", (hoverEdge === "r" || selected) && "opacity-100")}>
        <div className="mx-auto mt-[35%] h-[30%] w-[3px] rounded-full bg-white/80" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audio clip                                                           */
/* ------------------------------------------------------------------ */

export function audioClipLength(clip: AudioClip, script: EditScript): number {
  if (clip.outMs !== undefined) return Math.max(0, clip.outMs - clip.inMs);
  const asset = script.assets[clip.assetId];
  if (clip.loop) return Math.max(0, script.output.durationMs - clip.startMs);
  if (asset?.durationMs !== undefined) return Math.max(0, asset.durationMs - clip.inMs);
  return 3000;
}

function AudioClipBlock({ clip, track, script }: { clip: AudioClip; track: AudioTrack; script: EditScript }) {
  const scale = useScale();
  const ui = useTimelineUi();
  const selected = useEditor((s) => s.selection?.kind === "audio" && s.selection.id === clip.id);
  const [ghost, setGhost] = React.useState<Ghost>(null);
  const len = audioClipLength(clip, script);
  const asset = script.assets[clip.assetId];
  const startMs = ghost?.startMs ?? clip.startMs;
  const durMs = ghost?.durMs ?? len;
  const left = scale.msToPx(startMs);
  const width = Math.max(2, scale.msToPx(durMs));
  const hue = track.role === "music" ? 265 : track.role === "sfx" ? 190 : 140;
  const name = clip.label ?? asset?.name ?? clip.assetId;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const edge = rect.width > 24 ? 8 : rect.width / 4;
    const mode: "move" | "trim-left" | "trim-right" = x < edge ? "trim-left" : x > rect.width - edge ? "trim-right" : "move";
    const st = useEditor.getState();
    if (!st.script) return;
    const candidates = snapCandidates(st.script, clip.id, st.playheadMs);
    const thr = scale.pxToMs(8);
    const maxSource = asset?.durationMs;
    let patch: Partial<AudioClip> = {};
    startPointerDrag(e, {
      onStart: () => st.select({ kind: "audio", id: clip.id, trackId: track.id }),
      onMove: (dx) => {
        const dms = scale.pxToMs(dx);
        if (mode === "move") {
          let start = Math.max(0, clip.startMs + dms);
          const s = snapMs(start, candidates, thr);
          if (s.snapped !== null) {
            start = s.ms;
            ui.setGuide(s.ms);
          } else ui.setGuide(null);
          start = Math.round(start);
          patch = { startMs: start };
          setGhost({ startMs: start, durMs: len });
        } else if (mode === "trim-left") {
          const minStart = clip.startMs - clip.inMs;
          const maxStart = clip.startMs + len - MIN_CLIP_MS;
          let ns = clamp(clip.startMs + dms, minStart, maxStart);
          const s = snapMs(ns, candidates, thr);
          if (s.snapped !== null && s.ms >= minStart && s.ms <= maxStart) {
            ns = s.ms;
            ui.setGuide(s.ms);
          } else ui.setGuide(null);
          ns = Math.round(ns);
          patch = { startMs: ns, inMs: clip.inMs + (ns - clip.startMs), outMs: clip.outMs ?? clip.inMs + len };
          setGhost({ startMs: ns, durMs: len - (ns - clip.startMs) });
        } else {
          const minEnd = clip.startMs + MIN_CLIP_MS;
          const maxEnd = maxSource && !clip.loop ? clip.startMs + (maxSource - clip.inMs) : Infinity;
          let ne = clamp(clip.startMs + len + dms, minEnd, maxEnd);
          const s = snapMs(ne, candidates, thr);
          if (s.snapped !== null && s.ms >= minEnd && s.ms <= maxEnd) {
            ne = s.ms;
            ui.setGuide(s.ms);
          } else ui.setGuide(null);
          ne = Math.round(ne);
          patch = { outMs: clip.inMs + (ne - clip.startMs) };
          setGhost({ startMs: clip.startMs, durMs: ne - clip.startMs });
        }
      },
      onEnd: (_dx, _dy, _ev, dragged) => {
        ui.setGuide(null);
        setGhost(null);
        const s = useEditor.getState();
        if (!dragged) return s.select({ kind: "audio", id: clip.id, trackId: track.id });
        if (Object.keys(patch).length) s.applyOps([{ op: "updateAudioClip", clipId: clip.id, patch }], mode === "move" ? "Move audio" : "Trim audio");
      },
    });
  };

  return (
    <div
      className={cn("absolute top-1 bottom-1 cursor-grab select-none overflow-hidden rounded-[5px] border text-[10px] leading-none", selected ? "z-10 border-accent shadow-[0_0_0_1px_var(--color-accent)]" : "border-black/40 hover:border-white/30", track.muted && "opacity-50")}
      style={{ left, width, backgroundColor: `hsla(${hue}, 45%, 32%, 1)` }}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        useEditor.getState().select({ kind: "audio", id: clip.id, trackId: track.id });
        ui.openClipMenu(e.clientX, e.clientY, { kind: "audio", clip, trackId: track.id });
      }}
      title={`${name}${clip.reason ? `\n${clip.reason}` : ""}`}
    >
      <Waveform hue={hue} seed={clip.id} />
      {clip.fadeInMs > 0 && <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-black/50 to-transparent" style={{ width: scale.msToPx(clip.fadeInMs) }} />}
      {clip.fadeOutMs > 0 && <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-black/50 to-transparent" style={{ width: scale.msToPx(clip.fadeOutMs) }} />}
      {width > 50 && (
        <div className="absolute inset-x-1.5 top-1 flex items-center justify-between gap-1 text-white/90">
          <span className="truncate font-medium">{name}</span>
          <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] opacity-80">
            {clip.ducking && <span title="Ducked under speech">duck</span>}
            {clip.loop && <InfinityIcon className="h-2.5 w-2.5" />}
            {clip.gainDb !== 0 && `${clip.gainDb > 0 ? "+" : ""}${clip.gainDb}dB`}
          </span>
        </div>
      )}
    </div>
  );
}

function Waveform({ hue, seed }: { hue: number; seed: string }) {
  const id = React.useId();
  const bars = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const out: number[] = [];
    for (let i = 0; i < 24; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      out.push(0.25 + ((h >>> 8) % 1000) / 1000 * 0.7);
    }
    return out;
  }, [seed]);
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width={72} height="100%" patternUnits="userSpaceOnUse">
          {bars.map((b, i) => (
            <rect key={i} x={i * 3} y={`${(1 - b) * 50}%`} width={2} height={`${b * 100}%`} fill={`hsla(${hue}, 70%, 75%, 0.55)`} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Graphics                                                             */
/* ------------------------------------------------------------------ */

function GraphicBlock({ item, track, script, lane }: { item: GraphicItem; track: GraphicsTrack; script: EditScript; lane: number }) {
  const scale = useScale();
  const ui = useTimelineUi();
  const selected = useEditor((s) => s.selection?.kind === "graphic" && s.selection.id === item.id);
  const [ghost, setGhost] = React.useState<Ghost>(null);
  const full = item.durationMs === 0;
  const len = full ? Math.max(0, script.output.durationMs - item.startMs) : item.durationMs;
  const startMs = ghost?.startMs ?? item.startMs;
  const durMs = ghost?.durMs ?? len;
  const left = scale.msToPx(startMs);
  const width = Math.max(2, scale.msToPx(durMs));
  const text = (item.props.text ?? item.props.name ?? item.props.headline ?? item.props.title ?? item.props.label) as string | undefined;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mode: "move" | "resize" = !full && x > rect.width - 8 && rect.width > 20 ? "resize" : "move";
    const st = useEditor.getState();
    if (!st.script) return;
    const candidates = snapCandidates(st.script, item.id, st.playheadMs);
    const thr = scale.pxToMs(8);
    let patch: Partial<GraphicItem> = {};
    startPointerDrag(e, {
      onStart: () => st.select({ kind: "graphic", id: item.id }),
      onMove: (dx) => {
        const dms = scale.pxToMs(dx);
        if (mode === "move") {
          let start = Math.max(0, item.startMs + dms);
          const s1 = snapMs(start, candidates, thr);
          const s2 = snapMs(start + len, candidates, thr);
          if (s1.snapped !== null) {
            start = s1.ms;
            ui.setGuide(s1.ms);
          } else if (s2.snapped !== null && !full) {
            start = s2.ms - len;
            ui.setGuide(s2.ms);
          } else ui.setGuide(null);
          start = Math.max(0, Math.round(start));
          patch = { startMs: start };
          setGhost({ startMs: start, durMs: len });
        } else {
          let ne = Math.max(item.startMs + MIN_CLIP_MS, item.startMs + len + dms);
          const s = snapMs(ne, candidates, thr);
          if (s.snapped !== null && s.ms > item.startMs + MIN_CLIP_MS) {
            ne = s.ms;
            ui.setGuide(s.ms);
          } else ui.setGuide(null);
          ne = Math.round(ne);
          patch = { durationMs: ne - item.startMs };
          setGhost({ startMs: item.startMs, durMs: ne - item.startMs });
        }
      },
      onEnd: (_dx, _dy, _ev, dragged) => {
        ui.setGuide(null);
        setGhost(null);
        const s = useEditor.getState();
        if (!dragged) return s.select({ kind: "graphic", id: item.id });
        if (Object.keys(patch).length) s.applyOps([{ op: "updateGraphic", itemId: item.id, patch }], mode === "move" ? "Move graphic" : "Resize graphic");
      },
    });
  };

  return (
    <div
      className={cn("absolute flex h-[20px] cursor-grab select-none items-center gap-1 overflow-hidden rounded-full border px-2 text-[10px] leading-none", selected ? "z-10 border-accent bg-accent/30 text-fg" : "border-accent/30 bg-accent/15 text-accent hover:border-accent/60")}
      style={{ left, width, top: 4 + lane * 22 }}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        useEditor.getState().select({ kind: "graphic", id: item.id });
        ui.openClipMenu(e.clientX, e.clientY, { kind: "graphic", item, trackId: track.id });
      }}
      title={`${item.component}${text ? ` · ${text}` : ""}${item.reason ? `\n${item.reason}` : ""}`}
    >
      <Shapes className="h-2.5 w-2.5 shrink-0" />
      {width > 60 && <span className="truncate font-medium">{item.component}{text ? ` · ${text}` : ""}</span>}
      {full && width > 90 && <InfinityIcon className="ml-auto h-2.5 w-2.5 shrink-0 opacity-70" />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Captions                                                             */
/* ------------------------------------------------------------------ */

function CaptionWords({ track }: { track: CaptionTrack }) {
  const scale = useScale();
  const select = useEditor((s) => s.select);
  const seek = useEditor((s) => s.seek);
  const selected = useEditor((s) => s.selection?.kind === "captions");
  // merge words that would be narrower than 2px to keep the DOM light when zoomed out
  const blocks = React.useMemo(() => {
    const minMs = scale.pxToMs(3);
    const out: { t: number; d: number; text: string; emphasis?: boolean }[] = [];
    for (const w of track.words) {
      const last = out[out.length - 1];
      if (last && w.t - (last.t + last.d) < minMs && last.d < minMs * 8) {
        last.d = w.t + w.d - last.t;
        last.text += ` ${w.text}`;
      } else out.push({ t: w.t, d: w.d, text: w.text, emphasis: w.emphasis });
    }
    return out;
  }, [track.words, scale]);
  return (
    <div className={cn("absolute inset-0", !track.enabled && "opacity-40")} onPointerDown={(e) => { if (e.target === e.currentTarget) select({ kind: "captions", id: "captions" }); }}>
      {blocks.map((w, i) => {
        const width = Math.max(1.5, scale.msToPx(w.d) - 1);
        return (
          <button
            type="button"
            key={`${w.t}-${i}`}
            className={cn("absolute top-[3px] bottom-[3px] overflow-hidden rounded-[3px] px-1 text-left text-[9px] leading-none", selected ? "bg-accent-2/40 text-fg" : "bg-accent-2/25 text-accent-2 hover:bg-accent-2/40", w.emphasis && "ring-1 ring-accent/60")}
            style={{ left: scale.msToPx(w.t), width }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              select({ kind: "captions", id: "captions" });
              seek(w.t);
            }}
            title={w.text}
          >
            {width > 22 && <span className="block truncate pt-[3px]">{w.text}</span>}
          </button>
        );
      })}
    </div>
  );
}
