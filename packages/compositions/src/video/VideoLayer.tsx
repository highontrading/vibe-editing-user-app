import React, { useMemo } from "react";
import { AbsoluteFill, Freeze, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { EditScript, Transition, VideoClip, VideoTrack } from "@vibe/edl";
import { ClipMedia } from "./ClipMedia";
import { TransitionOverlay, boundaryTransition, enterTransition, exitTransition, IDENTITY } from "./transitions";
import { clipDurationFrames, msToFrames } from "../lib/time";

interface PlacedClip {
  clip: VideoClip;
  start: number;
  dur: number;
  /** Transition across the boundary with the previous adjacent clip (drawn with the previous clip's tail). */
  boundaryIn?: { transition: Transition; frames: number; prev: PlacedClip };
  /** Transition in from the background (no adjacent previous clip). */
  soloIn?: { transition: Transition; frames: number };
  /** Transition out to the background (not consumed by the next clip). */
  soloOut?: { transition: Transition; frames: number };
}

const usable = (t: Transition | undefined): Transition | undefined => (t && t.type !== "cut" && t.durationMs > 0 ? t : undefined);

export function placeClips(track: VideoTrack, fps: number): PlacedClip[] {
  const sorted = [...track.clips].sort((a, b) => a.startMs - b.startMs);
  const placed: PlacedClip[] = sorted.map((clip) => ({ clip, start: msToFrames(clip.startMs, fps), dur: clipDurationFrames(clip, fps) }));
  for (let i = 0; i < placed.length; i++) {
    const cur = placed[i];
    const prev = i > 0 ? placed[i - 1] : undefined;
    const adjacent = prev !== undefined && Math.abs(prev.start + prev.dur - cur.start) <= 1;
    const incoming = usable(cur.clip.transitionIn) ?? (adjacent ? usable(prev?.clip.transitionOut) : undefined);
    if (incoming) {
      const frames = Math.max(2, Math.min(msToFrames(incoming.durationMs, fps), cur.dur, prev ? prev.dur : Infinity));
      if (adjacent && prev) cur.boundaryIn = { transition: incoming, frames, prev };
      else cur.soloIn = { transition: incoming, frames };
    }
  }
  for (let i = 0; i < placed.length; i++) {
    const cur = placed[i];
    const next = placed[i + 1];
    const consumed = next?.boundaryIn?.prev === cur;
    const out = usable(cur.clip.transitionOut);
    if (out && !consumed) cur.soloOut = { transition: out, frames: Math.max(2, Math.min(msToFrames(out.durationMs, fps), cur.dur)) };
  }
  return placed;
}

const ClipInstance: React.FC<{ placed: PlacedClip; script: EditScript }> = ({ placed, script }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { clip, dur } = placed;
  const asset = script.assets[clip.assetId];

  let visual = IDENTITY;
  let overlay: ReturnType<typeof boundaryTransition>["overlay"] = null;
  let tail: React.ReactNode = null;

  if (placed.boundaryIn && frame < placed.boundaryIn.frames) {
    const { transition, frames, prev } = placed.boundaryIn;
    const p = frame / frames;
    const b = boundaryTransition(transition.type, p, width, height, clip.id, frame);
    visual = b.incoming;
    overlay = b.overlay;
    if (b.showOutgoing) {
      const prevAsset = script.assets[prev.clip.assetId];
      // Freeze the tail on the last real frame when the source would run out.
      const prevSpeed = prev.clip.speed || 1;
      const sourceEndMs = prev.clip.inMs + ((prev.dur + frames) / fps) * 1000 * prevSpeed;
      const exceeds = prevAsset?.durationMs !== undefined && prevAsset.kind === "video" && sourceEndMs > prevAsset.durationMs;
      const tailLocal = prev.dur + frame;
      tail = (
        <Sequence from={-prev.dur} durationInFrames={prev.dur + frames} name={`${prev.clip.label ?? prev.clip.id} (tail)`} showInTimeline={false}>
          <Freeze frame={Math.max(0, prev.dur - 1)} active={exceeds}>
            <ClipMedia
              clip={prev.clip}
              asset={prevAsset}
              fps={fps}
              width={width}
              height={height}
              localFrame={exceeds ? prev.dur - 1 : tailLocal}
              durFrames={prev.dur}
              visual={b.outgoing}
              primary={false}
              instanceId={`${prev.clip.id}-tail`}
            />
          </Freeze>
        </Sequence>
      );
    }
  } else if (placed.soloIn && frame < placed.soloIn.frames) {
    const r = enterTransition(placed.soloIn.transition.type, frame / placed.soloIn.frames, width, height, clip.id, frame);
    visual = r.visual;
    overlay = r.overlay;
  }

  if (placed.soloOut && frame >= dur - placed.soloOut.frames) {
    const p = (frame - (dur - placed.soloOut.frames)) / placed.soloOut.frames;
    const r = exitTransition(placed.soloOut.transition.type, p, width, height, clip.id, frame);
    visual = r.visual;
    overlay = r.overlay ?? overlay;
  }

  return (
    <AbsoluteFill>
      {tail}
      <ClipMedia clip={clip} asset={asset} fps={fps} width={width} height={height} localFrame={frame} durFrames={dur} visual={visual} primary instanceId={clip.id} />
      <TransitionOverlay overlay={overlay} />
    </AbsoluteFill>
  );
};

export const VideoTrackLayer: React.FC<{ track: VideoTrack; script: EditScript }> = ({ track, script }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const placed = useMemo(() => placeClips(track, fps), [track, fps]);
  const premount = Math.round(fps * 0.75);
  return (
    <AbsoluteFill>
      {placed.map((p) => {
        if (p.start >= durationInFrames || p.start + p.dur <= 0) return null;
        return (
          <Sequence key={p.clip.id} from={p.start} durationInFrames={p.dur} premountFor={premount} name={p.clip.label ?? p.clip.id}>
            <ClipInstance placed={p} script={script} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** All video tracks, layer 0 first (bottom) then overlays on top. */
export const VideoTracks: React.FC<{ script: EditScript }> = ({ script }) => {
  const tracks = useMemo(
    () => script.tracks.filter((t): t is VideoTrack => t.kind === "video").sort((a, b) => a.layer - b.layer),
    [script.tracks],
  );
  return (
    <AbsoluteFill>
      {tracks.map((t) => (
        <VideoTrackLayer key={t.id} track={t} script={script} />
      ))}
    </AbsoluteFill>
  );
};
