import React, { useCallback, useState } from "react";
import { AbsoluteFill, Freeze, Img, OffthreadVideo, getRemotionEnvironment } from "remotion";
import type { AssetRef, VideoClip } from "@vibe/edl";
import { computeClipFx, rampProgress, speedRampParams } from "./effects";
import { ChannelFilters, MotionBlurFilter, glitchBands, type TransitionVisual, IDENTITY } from "./transitions";
import { msToFrames } from "../lib/time";

export interface ClipMediaProps {
  clip: VideoClip;
  asset: AssetRef | undefined;
  fps: number;
  width: number;
  height: number;
  /** Frame relative to the clip's own start (may exceed its duration for transition tails). */
  localFrame: number;
  /** Clip duration in frames (output timeline). */
  durFrames: number;
  /** Transition state applied to the whole clip. */
  visual?: TransitionVisual;
  /** Only the primary instance carries audio; tails and glitch copies are muted. */
  primary: boolean;
  /** Unique id for SVG filter ids. */
  instanceId: string;
}

const PLACEHOLDER_BG = "linear-gradient(135deg, #15161c 0%, #23252f 100%)";

export const MissingAsset: React.FC<{ name: string | undefined; kind?: string }> = ({ name, kind }) => (
  <AbsoluteFill style={{ background: PLACEHOLDER_BG, alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.55)", fontFamily: "Inter, system-ui, sans-serif" }}>
    <div style={{ width: "22%", maxWidth: 160, aspectRatio: "1 / 1", borderRadius: "18%", border: "3px dashed rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
      <svg viewBox="0 0 24 24" width="45%" height="45%" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <rect x={3} y={5} width={18} height={14} rx={2} />
        <path d="M3 15l5-5 4 4 3-3 6 6" />
        <circle cx={16} cy={9} r={1.5} />
      </svg>
    </div>
    <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 0.3, textAlign: "center", padding: "0 10%" }}>{name || "Missing media"}</div>
    <div style={{ fontSize: 18, opacity: 0.6, marginTop: 8 }}>{kind ? `${kind} unavailable` : "asset unavailable"}</div>
  </AbsoluteFill>
);

function mediaTransform(clip: VideoClip, asset: AssetRef | undefined, width: number, height: number): { outer: React.CSSProperties; inner: React.CSSProperties } {
  const t = clip.transform;
  const outer: React.CSSProperties = {
    transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale}) rotate(${t.rotate}deg)`,
    transformOrigin: "50% 50%",
  };
  const inner: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
  if (t.crop && asset?.width && asset?.height) {
    // Precise crop: scale the natural frame so the crop rectangle covers the output.
    const s = Math.max(width / t.crop.width, height / t.crop.height);
    const cx = t.crop.x + t.crop.width / 2;
    const cy = t.crop.y + t.crop.height / 2;
    Object.assign(inner, {
      position: "absolute",
      width: asset.width * s,
      height: asset.height * s,
      left: width / 2 - cx * s,
      top: height / 2 - cy * s,
      objectFit: "fill",
    } satisfies React.CSSProperties);
  } else if (t.crop && asset?.width && !asset.height) {
    inner.objectPosition = `${((t.crop.x + t.crop.width / 2) / asset.width) * 100}% 50%`;
  }
  return { outer, inner };
}

export const ClipMedia: React.FC<ClipMediaProps> = ({ clip, asset, fps, width, height, localFrame, durFrames, visual = IDENTITY, primary, instanceId }) => {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  const { isRendering } = getRemotionEnvironment();

  const fx = computeClipFx(clip, localFrame, fps, durFrames, width, height, clip.id);
  const filters = [...fx.filters];
  const blurId = `mb-${instanceId}`;
  const hasMotionBlur = visual.blurX > 0.3 || visual.blurY > 0.3;
  if (hasMotionBlur) filters.unshift(`url(#${blurId})`);
  if (Math.abs(visual.brightness - 1) > 0.01) filters.push(`brightness(${visual.brightness.toFixed(3)})`);

  const outerStyle: React.CSSProperties = {
    opacity: Math.max(0, Math.min(1, visual.opacity)),
    transform: `translate(${(visual.translateX + fx.x).toFixed(2)}px, ${(visual.translateY + fx.y).toFixed(2)}px) scale(${(visual.scale * fx.scale).toFixed(4)}) rotate(${fx.rotate.toFixed(3)}deg)`,
    transformOrigin: "50% 50%",
    overflow: "hidden",
    backfaceVisibility: "hidden",
  };

  const { outer, inner } = mediaTransform(clip, asset, width, height);
  const ramp = speedRampParams(clip);

  const renderMedia = (withAudio: boolean): React.ReactNode => {
    if (!asset || !asset.url || failed || asset.kind === "audio") {
      return <MissingAsset name={asset?.name ?? clip.label ?? clip.assetId} kind={asset?.kind} />;
    }
    if (asset.kind === "image") {
      return <Img src={asset.url} style={inner} onImageError={onError} pauseWhenLoading />;
    }
    const trimBefore = msToFrames(clip.inMs, fps);
    const volume = withAudio ? Math.max(0, Math.min(2, clip.volume)) : 0;
    const muted = !withAudio || clip.volume <= 0;
    if (ramp && isRendering) {
      // Time remap for speed ramps: pick the source frame for this output frame explicitly.
      const sourceSpan = msToFrames(clip.outMs - clip.inMs, fps);
      const sourceLocal = Math.round(rampProgress(localFrame / Math.max(1, durFrames), ramp.from, ramp.to) * Math.max(0, sourceSpan - 1));
      return (
        <Freeze frame={sourceLocal}>
          <OffthreadVideo src={asset.url} trimBefore={trimBefore} style={inner} muted onError={onError} pauseWhenBuffering />
        </Freeze>
      );
    }
    return (
      <OffthreadVideo
        src={asset.url}
        trimBefore={trimBefore}
        playbackRate={clip.speed || 1}
        volume={volume}
        muted={muted}
        style={inner}
        onError={onError}
        pauseWhenBuffering
        toneMapped
      />
    );
  };

  const glitch = visual.glitch > 0.5;
  const filterStyle = filters.length ? filters.join(" ") : undefined;
  const content = (withAudio: boolean) => (
    <AbsoluteFill style={{ ...outer, filter: filterStyle }}>{renderMedia(withAudio)}</AbsoluteFill>
  );

  return (
    <AbsoluteFill style={outerStyle}>
      {hasMotionBlur ? <MotionBlurFilter id={blurId} x={visual.blurX} y={visual.blurY} /> : null}
      {glitch ? <ChannelFilters /> : null}
      {glitch ? (
        <>
          <AbsoluteFill style={{ filter: "url(#vibe-chan-gb)" }}>{content(primary)}</AbsoluteFill>
          <AbsoluteFill style={{ filter: "url(#vibe-chan-r)", mixBlendMode: "screen", transform: `translateX(${(-visual.glitch).toFixed(1)}px)` }}>{content(false)}</AbsoluteFill>
          <AbsoluteFill style={{ clipPath: glitchBands(instanceId, localFrame, "a", height), transform: `translateX(${(visual.glitch * 2.2).toFixed(1)}px) scaleX(1.02)`, filter: "saturate(1.8) contrast(1.2)", opacity: 0.9 }}>{content(false)}</AbsoluteFill>
        </>
      ) : (
        content(primary)
      )}
      {fx.overlays}
    </AbsoluteFill>
  );
};
