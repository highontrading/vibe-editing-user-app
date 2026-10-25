"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, Repeat, Volume2, VolumeX, Captions, CaptionsOff, Maximize2, Minimize2, Columns2, ShieldCheck, Loader2, SkipBack, SkipForward, RotateCcw, X, Eye } from "lucide-react";
import { PLATFORM_PRESETS, type EditScript, type Platform } from "@vibe/edl";
import { api, cn } from "@/lib/utils";
import { fmtTime } from "@/lib/editor/format";
import { useEditor, useDisplayScript } from "@/lib/editor/store";
import type { VersionView, VersionWithScript } from "@/lib/editor/types";
import { toast } from "@/components/ui/toast";
import { IconButton } from "../panel";

const RemotionPlayer = dynamic(() => import("./remotion-player"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ),
});

function useSize<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 1 && Math.abs(s.height - height) < 1 ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function fit(areaW: number, areaH: number, w: number, h: number) {
  if (!areaW || !areaH || !w || !h) return { width: 0, height: 0 };
  const scale = Math.min(areaW / w, areaH / h);
  return { width: Math.floor(w * scale), height: Math.floor(h * scale) };
}

/** Script shown by the player, with captions hidden when the preview toggle is off. */
function useRenderScript(script: EditScript | null, captionsVisible: boolean): EditScript | null {
  return React.useMemo(() => {
    if (!script || captionsVisible) return script;
    return { ...script, tracks: script.tracks.map((t) => (t.kind === "captions" ? { ...t, enabled: false } : t)) };
  }, [script, captionsVisible]);
}

export function PreviewPanel() {
  const script = useDisplayScript();
  const workingScript = useEditor((s) => s.script);
  const playing = useEditor((s) => s.playing);
  const muted = useEditor((s) => s.muted);
  const loop = useEditor((s) => s.loop);
  const safeZone = useEditor((s) => s.safeZone);
  const captionsVisible = useEditor((s) => s.captionsVisible);
  const compareMode = useEditor((s) => s.compareMode);
  const compareVersion = useEditor((s) => s.compareVersion);
  const previewVersion = useEditor((s) => s.previewVersion);
  const playbackRate = useEditor((s) => s.playbackRate);
  const seekSeq = useEditor((s) => s.seekSeq);
  const playheadMs = useEditor((s) => s.playheadMs);
  const set = useEditor((s) => s.set);
  const setPlayheadFromPlayer = useEditor((s) => s.setPlayheadFromPlayer);
  const setPlaying = useEditor((s) => s.setPlaying);
  const project = useEditor((s) => s.project);
  const [areaRef, area] = useSize<HTMLDivElement>();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = React.useState(false);

  const renderScript = useRenderScript(script, captionsVisible);
  const compareScript = useRenderScript(compareMode ? compareVersion?.script ?? null : null, captionsVisible);
  const showCompare = compareMode && !!compareScript && !previewVersion;

  const pad = 24;
  const slots = showCompare ? 2 : 1;
  const box = script ? fit((area.width - pad * 2 - (slots - 1) * 16) / slots, area.height - pad * 2, script.output.width, script.output.height) : { width: 0, height: 0 };

  const platform = (script?.meta.platform ?? project?.platform ?? "custom") as Platform;
  const preset = PLATFORM_PRESETS[platform] ?? PLATFORM_PRESETS.custom;
  const duration = script?.output.durationMs ?? 0;

  const onFrame = React.useCallback((ms: number) => setPlayheadFromPlayer(ms), [setPlayheadFromPlayer]);
  const onPlayingChange = React.useCallback((p: boolean) => setPlaying(p), [setPlaying]);
  const onEnded = React.useCallback(() => {
    if (!useEditor.getState().loop) useEditor.getState().set({ playbackRate: 1 });
  }, []);

  React.useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  const toggleCompare = async () => {
    if (compareMode) return set({ compareMode: false, compareVersion: null });
    const st = useEditor.getState();
    const idx = st.versions.findIndex((v) => v.id === st.currentVersionId);
    const prev = idx >= 0 ? st.versions[idx + 1] : st.versions[1];
    if (!prev) return toast.info("No previous version to compare with");
    try {
      const v = await api<VersionWithScript>(`/api/projects/${st.projectId}/versions/${prev.id}`);
      set({ compareMode: true, compareVersion: v });
    } catch (e) {
      toast.error("Couldn't load previous version", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-1 flex-col bg-[#07070a]">
      <div ref={areaRef} className="relative min-h-0 flex-1">
        {/* subtle grid backdrop */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="absolute inset-0 flex items-center justify-center gap-4" style={{ padding: pad }}>
          {showCompare && compareScript && (
            <Frame label={`Previous · ${compareVersion?.label ?? compareVersion?.summary ?? ""}`} width={box.width} height={box.height}>
              <RemotionPlayer script={compareScript} width={box.width} height={box.height} playing={playing} muted loop={loop} playbackRate={playbackRate} seekSeq={seekSeq} playheadMs={playheadMs} />
              {safeZone && <SafeZones top={preset.safeTop} bottom={preset.safeBottom} />}
            </Frame>
          )}
          {renderScript && box.width > 0 ? (
            <Frame label={showCompare ? "Current" : undefined} width={box.width} height={box.height} highlight={!!previewVersion}>
              <RemotionPlayer
                script={renderScript}
                width={box.width}
                height={box.height}
                playing={playing}
                muted={muted}
                loop={loop}
                playbackRate={playbackRate}
                seekSeq={seekSeq}
                playheadMs={playheadMs}
                onFrame={onFrame}
                onPlayingChange={onPlayingChange}
                onEnded={onEnded}
              />
              {safeZone && <SafeZones top={preset.safeTop} bottom={preset.safeBottom} label={preset.label} />}
            </Frame>
          ) : (
            !renderScript && <div className="text-sm text-muted">No edit to preview yet.</div>
          )}
        </div>
        <AnimatePresence>
          {previewVersion && (
            <motion.div initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent/40 bg-bg-2/95 px-3 py-1.5 text-xs shadow-xl backdrop-blur">
              <Eye className="h-3.5 w-3.5 text-accent" />
              <span className="max-w-[260px] truncate">Previewing <span className="font-medium">{previewVersion.label ?? previewVersion.summary}</span></span>
              <RestoreButton versionId={previewVersion.id} />
              <button type="button" onClick={() => set({ previewVersion: null })} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-muted hover:bg-white/10 hover:text-fg">
                <X className="h-3 w-3" /> Back to current
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {workingScript && workingScript.output.durationMs === 0 && !previewVersion && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="rounded-full border border-border bg-bg-2/90 px-3 py-1 text-[11px] text-muted">The edit is empty: add a clip from the timeline or ask the editor.</span>
          </div>
        )}
      </div>
      <Controls duration={duration} fps={script?.output.fps ?? 30} compare={showCompare} onToggleCompare={toggleCompare} fullscreen={fullscreen} onToggleFullscreen={toggleFullscreen} />
    </div>
  );
}

function Frame({ children, label, width, height, highlight }: { children: React.ReactNode; label?: string; width: number; height: number; highlight?: boolean }) {
  return (
    <div className="relative flex flex-col items-center gap-1.5">
      {label && <div className="absolute -top-5 left-0 truncate text-[10px] font-medium uppercase tracking-[0.1em] text-muted" style={{ maxWidth: width }}>{label}</div>}
      <div className={cn("relative overflow-hidden rounded-md bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_30px_80px_-30px_rgba(0,0,0,0.9)]", highlight && "ring-2 ring-accent/60")} style={{ width, height }}>
        {children}
      </div>
    </div>
  );
}

function SafeZones({ top, bottom, label }: { top: number; bottom: number; label?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 border-b border-dashed border-accent/70 bg-accent/10" style={{ height: `${top * 100}%` }} />
      <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-accent/70 bg-accent/10" style={{ height: `${bottom * 100}%` }}>
        {label && <span className="absolute bottom-1 right-1.5 text-[9px] font-medium uppercase tracking-wider text-accent/90">{label} safe zone</span>}
      </div>
      <div className="absolute inset-y-0 left-[5%] border-l border-dashed border-white/15" />
      <div className="absolute inset-y-0 right-[5%] border-r border-dashed border-white/15" />
    </div>
  );
}

function RestoreButton({ versionId }: { versionId: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const st = useEditor.getState();
        try {
          const res = await api<{ version: VersionView; script: EditScript }>(`/api/projects/${st.projectId}/versions/${versionId}/restore`, { method: "POST", json: {} });
          st.adoptScript(res.script, res.version);
          toast.success("Version restored");
        } catch (e) {
          toast.error("Couldn't restore", e instanceof Error ? e.message : undefined);
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 font-medium text-black hover:bg-accent/90 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore
    </button>
  );
}

function Controls({ duration, fps, compare, onToggleCompare, fullscreen, onToggleFullscreen }: { duration: number; fps: number; compare: boolean; onToggleCompare: () => void; fullscreen: boolean; onToggleFullscreen: () => void }) {
  const playing = useEditor((s) => s.playing);
  const playheadMs = useEditor((s) => s.playheadMs);
  const loop = useEditor((s) => s.loop);
  const muted = useEditor((s) => s.muted);
  const safeZone = useEditor((s) => s.safeZone);
  const captionsVisible = useEditor((s) => s.captionsVisible);
  const playbackRate = useEditor((s) => s.playbackRate);
  const set = useEditor((s) => s.set);
  const seek = useEditor((s) => s.seek);
  const togglePlaying = useEditor((s) => s.togglePlaying);
  const barRef = React.useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = React.useState(false);

  const posFromEvent = (e: React.PointerEvent | PointerEvent) => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    return (x / r.width) * duration;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setScrubbing(true);
    const wasPlaying = useEditor.getState().playing;
    if (wasPlaying) set({ playing: false });
    seek(posFromEvent(e));
    const move = (ev: PointerEvent) => seek(posFromEvent(ev));
    const up = () => {
      setScrubbing(false);
      if (wasPlaying) set({ playing: true });
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pct = duration ? Math.min(100, (playheadMs / duration) * 100) : 0;

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-t border-border bg-bg px-2">
      <IconButton title="Go to start (Home)" onClick={() => seek(0)}>
        <SkipBack className="h-3.5 w-3.5" />
      </IconButton>
      <button type="button" onClick={togglePlaying} className="flex h-8 w-8 items-center justify-center rounded-full bg-fg text-bg transition-transform hover:scale-105" aria-label={playing ? "Pause" : "Play"} title="Play / pause (space)">
        {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
      </button>
      <IconButton title="Go to end (End)" onClick={() => seek(duration)}>
        <SkipForward className="h-3.5 w-3.5" />
      </IconButton>
      <div className="w-[118px] shrink-0 font-mono text-[11px] tabular-nums text-muted">
        <span className="text-fg">{fmtTime(playheadMs, { frames: true, fps })}</span> / {fmtTime(duration, { frames: true, fps })}
      </div>
      <div ref={barRef} onPointerDown={onPointerDown} className={cn("group relative h-6 flex-1 cursor-pointer select-none", scrubbing && "cursor-grabbing")}>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10 transition-[height] group-hover:h-1.5">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow transition-transform group-hover:scale-110" style={{ left: `${pct}%` }} />
      </div>
      {playbackRate !== 1 && <span className="rounded bg-accent/15 px-1.5 font-mono text-[10px] text-accent">{playbackRate}×</span>}
      <div className="flex items-center gap-0.5">
        <IconButton title="Loop" active={loop} onClick={() => set({ loop: !loop })}>
          <Repeat className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton title={muted ? "Unmute" : "Mute"} active={muted} onClick={() => set({ muted: !muted })}>
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </IconButton>
        <IconButton title="Safe zones" active={safeZone} onClick={() => set({ safeZone: !safeZone })}>
          <ShieldCheck className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton title="Captions (C)" active={!captionsVisible} onClick={() => set({ captionsVisible: !captionsVisible })}>
          {captionsVisible ? <Captions className="h-3.5 w-3.5" /> : <CaptionsOff className="h-3.5 w-3.5" />}
        </IconButton>
        <IconButton title="Compare with previous version" active={compare} onClick={onToggleCompare}>
          <Columns2 className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton title={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={onToggleFullscreen}>
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </IconButton>
      </div>
    </div>
  );
}
