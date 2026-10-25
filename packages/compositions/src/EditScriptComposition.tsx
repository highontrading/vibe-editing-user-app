import React from "react";
import { AbsoluteFill } from "remotion";
import type { EditScript } from "@vibe/edl";

export const COMPOSITION_ID = "EditScript";

export interface EditScriptCompositionProps {
  script: EditScript;
}

export function getCompositionMetadata(script: EditScript) {
  const fps = script.output.fps || 30;
  return {
    width: script.output.width,
    height: script.output.height,
    fps,
    durationInFrames: Math.max(1, Math.ceil((script.output.durationMs / 1000) * fps)),
  };
}

/** STUB: replaced by the full renderer. */
export const EditScriptComposition: React.FC<EditScriptCompositionProps> = ({ script }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: script.output.background, color: "white", justifyContent: "center", alignItems: "center", fontFamily: "sans-serif", fontSize: 48 }}>
      {script.meta.title ?? "Edit"}
    </AbsoluteFill>
  );
};
