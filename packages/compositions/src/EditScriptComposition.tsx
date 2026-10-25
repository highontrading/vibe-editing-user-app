import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EditScriptSchema, computeDuration, getTrack, type EditScript } from "@vibe/edl";
import { VideoTracks } from "./video/VideoLayer";
import { GrainOverlay, VignetteOverlay } from "./video/effects";
import { gradeFor } from "./lib/colors";
import { Captions } from "./captions/Captions";
import { GraphicsTracks } from "./graphics/Graphics";
import { AudioTracks } from "./audio/AudioTracks";
import { WATERMARK_TOKEN, Watermark } from "./Watermark";

export const COMPOSITION_ID = "EditScript";

export type EditScriptCompositionProps = {
  script: EditScript;
  /** Draw the "Made with Vibe" badge. Also enabled when `script.meta.notes` contains `[watermark]`. */
  watermark?: boolean;
};

/**
 * Normalise a script coming from JSON (input props / API) so every default is
 * present. Falls back to the raw object if validation fails, so a slightly
 * out-of-date script still renders what it can.
 */
export function normalizeScript(script: EditScript): EditScript {
  const parsed = EditScriptSchema.safeParse(script);
  const s = parsed.success ? parsed.data : script;
  if (!s.output.durationMs) computeDuration(s);
  return s;
}

export function getCompositionMetadata(script: EditScript): { width: number; height: number; fps: number; durationInFrames: number } {
  const s = normalizeScript(script);
  const fps = s.output.fps || 30;
  return {
    width: Math.max(2, Math.round(s.output.width)),
    height: Math.max(2, Math.round(s.output.height)),
    fps,
    durationInFrames: Math.max(1, Math.ceil((s.output.durationMs / 1000) * fps)),
  };
}

export function shouldWatermark(script: EditScript, prop: boolean | undefined): boolean {
  return Boolean(prop) || Boolean(script.meta?.notes?.includes(WATERMARK_TOKEN));
}

export const EditScriptComposition: React.FC<EditScriptCompositionProps> = ({ script: rawScript, watermark }) => {
  const script = useMemo(() => normalizeScript(rawScript), [rawScript]);
  const frame = useCurrentFrame();
  const grade = gradeFor(script.global.colorPreset);
  const captions = getTrack(script, "captions");
  const showCaptions = Boolean(captions?.enabled && captions.words.length);

  return (
    <AbsoluteFill style={{ backgroundColor: script.output.background || "#000", overflow: "hidden" }}>
      {/* Footage with global colour grade */}
      <AbsoluteFill style={{ filter: grade.filter || undefined }}>
        <VideoTracks script={script} />
        {grade.overlays.map((o, i) => (
          <AbsoluteFill key={i} style={{ ...o, pointerEvents: "none" }} />
        ))}
      </AbsoluteFill>
      <GrainOverlay amount={script.global.grain} frame={frame} />
      <VignetteOverlay amount={script.global.vignette} />
      <GraphicsTracks script={script} />
      {showCaptions && captions ? <Captions track={captions} script={script} /> : null}
      <AudioTracks script={script} />
      {shouldWatermark(script, watermark) ? <Watermark /> : null}
    </AbsoluteFill>
  );
};
