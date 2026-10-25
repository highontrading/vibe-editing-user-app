"use client";
import * as React from "react";
import { Film, ImageIcon, Music } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { gradientFor } from "@/lib/options";

/**
 * Thumbnail-first media card. Shows the poster (thumbUrl) and plays the proxy/preview
 * video on hover when `previewUrl` is given. Falls back to a generated gradient.
 */
export function VideoThumb({
  thumbUrl,
  previewUrl,
  title,
  seed,
  durationMs,
  kind = "VIDEO",
  aspect = "aspect-video",
  className,
  badge,
  overlay,
  hoverPlay = true,
  children,
}: {
  thumbUrl?: string | null;
  previewUrl?: string | null;
  title?: string;
  seed?: string;
  durationMs?: number | null;
  kind?: "VIDEO" | "AUDIO" | "IMAGE";
  aspect?: string;
  className?: string;
  badge?: React.ReactNode;
  overlay?: React.ReactNode;
  hoverPlay?: boolean;
  children?: React.ReactNode;
}) {
  const [hover, setHover] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hover) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [hover]);
  const Icon = kind === "AUDIO" ? Music : kind === "IMAGE" ? ImageIcon : Film;
  return (
    <div
      className={cn("group relative w-full overflow-hidden rounded-xl bg-bg-3", aspect, className)}
      style={!thumbUrl ? { background: gradientFor(seed ?? title ?? "x") } : undefined}
      onMouseEnter={() => hoverPlay && setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbUrl} alt={title ?? ""} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="h-6 w-6 text-white/40" />
        </div>
      )}
      {previewUrl && hover && kind === "VIDEO" && (
        <video ref={videoRef} src={previewUrl} muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
      {badge && <div className="absolute left-2 top-2 flex gap-1">{badge}</div>}
      {durationMs != null && durationMs > 0 && <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{formatDuration(durationMs)}</div>}
      {overlay}
      {children}
    </div>
  );
}
