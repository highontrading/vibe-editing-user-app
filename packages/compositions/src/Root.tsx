import React from "react";
import { Composition } from "remotion";
import { emptyScript, type EditScript } from "@vibe/edl";
import { COMPOSITION_ID, EditScriptComposition, getCompositionMetadata } from "./EditScriptComposition";

export const RemotionRoot: React.FC = () => {
  const defaultScript = emptyScript({ aspect: "9:16", title: "Preview" });
  defaultScript.output.durationMs = 3000;
  return (
    <Composition
      id={COMPOSITION_ID}
      component={EditScriptComposition as React.FC<{ script: EditScript }>}
      defaultProps={{ script: defaultScript }}
      calculateMetadata={({ props }) => getCompositionMetadata(props.script)}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={90}
    />
  );
};
