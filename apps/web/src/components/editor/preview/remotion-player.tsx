"use client";
/**
 * Thin wrapper around @remotion/player. Loaded with next/dynamic (ssr: false)
 * from preview-panel.tsx. `component` is the module-level EditScriptComposition
 * so it is referentially stable; inputProps are memoised by script identity.
 */
import * as React from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { EditScriptComposition, getCompositionMetadata } from "@vibe/compositions";
import type { EditScript } from "@vibe/edl";

export interface RemotionPlayerProps {
  script: EditScript;
  width: number;
  height: number;
  playing: boolean;
  muted: boolean;
  loop: boolean;
  playbackRate: number;
  /** increments whenever the user seeks; the player then seeks to playheadMs */
  seekSeq: number;
  playheadMs: number;
  onFrame?: (ms: number) => void;
  onEnded?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
}

export default function RemotionPlayer({ script, width, height, playing, muted, loop, playbackRate, seekSeq, playheadMs, onFrame, onEnded, onPlayingChange, className }: RemotionPlayerProps) {
  const ref = React.useRef<PlayerRef>(null);
  const meta = React.useMemo(() => getCompositionMetadata(script), [script]);
  const inputProps = React.useMemo(() => ({ script }), [script]);
  const fps = meta.fps;

  // play / pause
  React.useEffect(() => {
    const p = ref.current;
    if (!p) return;
    if (playing && !p.isPlaying()) p.play();
    if (!playing && p.isPlaying()) p.pause();
  }, [playing]);

  // mute
  React.useEffect(() => {
    const p = ref.current;
    if (!p) return;
    if (muted) p.mute();
    else p.unmute();
  }, [muted]);

  // explicit seeks from the timeline / keyboard
  const lastSeek = React.useRef(seekSeq);
  React.useEffect(() => {
    if (seekSeq === lastSeek.current) return;
    lastSeek.current = seekSeq;
    const p = ref.current;
    if (!p) return;
    const frame = Math.max(0, Math.min(meta.durationInFrames - 1, Math.round((playheadMs / 1000) * fps)));
    p.seekTo(frame);
  }, [seekSeq, playheadMs, fps, meta.durationInFrames]);

  // events -> store
  React.useEffect(() => {
    const p = ref.current;
    if (!p) return;
    let raf = 0;
    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      if (!onFrame) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => onFrame(Math.round((e.detail.frame / fps) * 1000)));
    };
    const onPlay = () => onPlayingChange?.(true);
    const onPause = () => onPlayingChange?.(false);
    const onEnd = () => {
      onPlayingChange?.(false);
      onEnded?.();
    };
    p.addEventListener("frameupdate", onFrameUpdate);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onEnd);
    return () => {
      cancelAnimationFrame(raf);
      p.removeEventListener("frameupdate", onFrameUpdate);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onEnd);
    };
  }, [fps, onFrame, onPlayingChange, onEnded]);

  return (
    <Player
      ref={ref}
      component={EditScriptComposition}
      inputProps={inputProps}
      durationInFrames={meta.durationInFrames}
      compositionWidth={meta.width}
      compositionHeight={meta.height}
      fps={fps}
      style={{ width, height }}
      className={className}
      controls={false}
      loop={loop}
      clickToPlay={false}
      doubleClickToFullscreen={false}
      spaceKeyToPlayOrPause={false}
      playbackRate={playbackRate}
      initiallyMuted={muted}
      moveToBeginningWhenEnded={false}
      acknowledgeRemotionLicense
      errorFallback={({ error }) => (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#ff4d6d", fontSize: 14, padding: 24, textAlign: "center", background: "#0b0b0f" }}>
          Preview error: {error.message}
        </div>
      )}
    />
  );
}
