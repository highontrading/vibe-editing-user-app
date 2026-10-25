import React from "react";
import { Composition } from "remotion";
import { emptyScript } from "@vibe/edl";
import { COMPOSITION_ID, EditScriptComposition, getCompositionMetadata, type EditScriptCompositionProps } from "./EditScriptComposition";
import { captionPreviewScript } from "./previews";

function defaultScript() {
  const s = captionPreviewScript("bold-pop");
  s.meta.title = "Preview";
  return s;
}

export const RemotionRoot: React.FC = () => {
  const fallback = emptyScript({ aspect: "9:16" });
  const defaultProps: EditScriptCompositionProps = { script: defaultScript(), watermark: false };
  return (
    <Composition
      id={COMPOSITION_ID}
      component={EditScriptComposition}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        const meta = getCompositionMetadata(props.script ?? fallback);
        return { ...meta, props };
      }}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={90}
    />
  );
};
