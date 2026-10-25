import React, { useMemo } from "react";
import { Audio, Sequence, useVideoConfig } from "remotion";
import type { AudioClip, AudioTrack, EditScript, Word } from "@vibe/edl";
import { getTrack } from "@vibe/edl";
import { msToFrames } from "../lib/time";
import { speechActiveAt } from "../captions/grouping";

/** Music is lowered by this many dB while speech is active. */
export const DUCK_DB = -10;
export const DUCK_ATTACK_MS = 150;
export const DUCK_RELEASE_MS = 400;
/** Start lowering slightly before the word begins so the attack is complete when speech lands. */
const DUCK_LOOKAHEAD_MS = 80;

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

/**
 * Per-frame speech envelope (0 = silence, 1 = speech) smoothed with an
 * asymmetric one-pole filter: fast attack, slow release.
 */
export function computeSpeechEnvelope(words: Word[], fps: number, totalFrames: number): Float32Array {
  const env = new Float32Array(Math.max(1, totalFrames));
  if (!words.length) return env;
  const attack = 1 - Math.exp(-1000 / (fps * DUCK_ATTACK_MS));
  const release = 1 - Math.exp(-1000 / (fps * DUCK_RELEASE_MS));
  let level = 0;
  for (let f = 0; f < env.length; f++) {
    const tMs = (f / fps) * 1000;
    const target = speechActiveAt(words, tMs + DUCK_LOOKAHEAD_MS) || speechActiveAt(words, tMs) ? 1 : 0;
    level += (target - level) * (target > level ? attack : release);
    env[f] = level;
  }
  return env;
}

interface PlacedAudio {
  clip: AudioClip;
  src: string;
  from: number;
  seqDur: number;
  trimBefore: number;
  /** Source length in frames when known (needed for looping). */
  mediaDur: number | undefined;
}

function placeAudio(track: AudioTrack, script: EditScript, fps: number, totalFrames: number): PlacedAudio[] {
  const out: PlacedAudio[] = [];
  for (const clip of track.clips) {
    const asset = script.assets[clip.assetId];
    if (!asset || !asset.url || asset.kind === "image") continue;
    const from = msToFrames(clip.startMs, fps);
    if (from >= totalFrames) continue;
    const trimBefore = msToFrames(clip.inMs, fps);
    const mediaDur =
      clip.outMs !== undefined && clip.outMs > clip.inMs
        ? msToFrames(clip.outMs - clip.inMs, fps)
        : asset.durationMs !== undefined && asset.durationMs > clip.inMs
          ? msToFrames(asset.durationMs - clip.inMs, fps)
          : undefined;
    const remaining = totalFrames - from;
    const seqDur = Math.min(remaining, clip.loop ? remaining : (mediaDur ?? remaining));
    if (seqDur <= 0 || (mediaDur !== undefined && mediaDur <= 0)) continue;
    out.push({ clip, src: asset.url, from, seqDur, trimBefore, mediaDur });
  }
  return out;
}

const AudioClipView: React.FC<{ placed: PlacedAudio; envelope: Float32Array | null; fps: number }> = ({ placed, envelope, fps }) => {
  const { clip, src, from, seqDur, trimBefore, mediaDur } = placed;
  const gain = dbToGain(clip.gainDb);
  const fadeIn = msToFrames(clip.fadeInMs, fps);
  const fadeOut = msToFrames(clip.fadeOutMs, fps);
  const duckGain = dbToGain(DUCK_DB);
  const volume = useMemo(
    () => (f: number): number => {
      let v = gain;
      if (fadeIn > 0) v *= Math.min(1, Math.max(0, f / fadeIn));
      if (fadeOut > 0) v *= Math.min(1, Math.max(0, (seqDur - f) / fadeOut));
      if (envelope) {
        const idx = Math.min(envelope.length - 1, Math.max(0, Math.round(from + f)));
        const level = envelope[idx] ?? 0;
        v *= 1 + (duckGain - 1) * level;
      }
      return Math.max(0, Math.min(1, v));
    },
    [gain, fadeIn, fadeOut, seqDur, envelope, from, duckGain],
  );
  return (
    <Sequence from={from} durationInFrames={seqDur} name={clip.label ?? clip.id} layout="none">
      <Audio src={src} trimBefore={trimBefore} durationInFrames={clip.loop ? mediaDur : undefined} loop={clip.loop && mediaDur !== undefined} volume={volume} />
    </Sequence>
  );
};

export const AudioTracks: React.FC<{ script: EditScript }> = ({ script }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const captions = getTrack(script, "captions");
  const words = captions?.words ?? [];
  const tracks = script.tracks.filter((t): t is AudioTrack => t.kind === "audio" && !t.muted);
  const needsEnvelope = tracks.some((t) => t.clips.some((c) => c.ducking));
  const envelope = useMemo(() => (needsEnvelope ? computeSpeechEnvelope(words, fps, durationInFrames) : null), [needsEnvelope, words, fps, durationInFrames]);
  return (
    <>
      {tracks.map((track) =>
        placeAudio(track, script, fps, durationInFrames).map((p) => (
          <AudioClipView key={p.clip.id} placed={p} envelope={p.clip.ducking ? envelope : null} fps={fps} />
        )),
      )}
    </>
  );
};
