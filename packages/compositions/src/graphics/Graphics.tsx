import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { EditScript, GraphicComponentId, GraphicsTrack } from "@vibe/edl";
import { ChapterCard, CountdownTimer, EndCard, ImageOverlay, KineticTitle, LogoBug, LowerThird, PointerHighlight, ProgressBar, SplitScreen, SubscribeBubble, TextCallout, type GraphicProps } from "./components";
import { msToFrames } from "../lib/time";
import type { Rec } from "../lib/props";

export const GRAPHIC_COMPONENTS: Record<GraphicComponentId, React.FC<GraphicProps>> = {
  KineticTitle,
  LowerThird,
  EndCard,
  ProgressBar,
  SubscribeBubble,
  PointerHighlight,
  TextCallout,
  ImageOverlay,
  LogoBug,
  ChapterCard,
  CountdownTimer,
  SplitScreen,
};

export const GraphicsTracks: React.FC<{ script: EditScript }> = ({ script }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const tracks = script.tracks.filter((t): t is GraphicsTrack => t.kind === "graphics");
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {tracks.map((track) =>
        track.items.map((item) => {
          const Component = GRAPHIC_COMPONENTS[item.component];
          if (!Component) return null;
          const from = msToFrames(item.startMs, fps);
          // durationMs 0 means "until the end of the video".
          const dur = item.durationMs > 0 ? msToFrames(item.durationMs, fps) : durationInFrames - from;
          if (dur <= 0 || from >= durationInFrames) return null;
          if (frame < from || frame >= from + dur) return null;
          return (
            <Sequence key={item.id} from={from} durationInFrames={dur} name={item.component} layout="none">
              <Component props={(item.props ?? {}) as Rec} assets={script.assets} absoluteFrame={frame} totalFrames={durationInFrames} />
            </Sequence>
          );
        }),
      )}
    </AbsoluteFill>
  );
};
