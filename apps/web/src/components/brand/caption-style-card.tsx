"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const SAMPLE: Record<string, React.ReactNode> = {
  "bold-pop": (
    <>
      MOST <b>FOUNDERS</b> GET THIS WRONG
    </>
  ),
  "clean-minimal": <>Most founders get this wrong.</>,
  hormozi: (
    <>
      MOST FOUNDERS <b>GET THIS</b> WRONG
    </>
  ),
  karaoke: (
    <>
      <b>Most founders</b> get this wrong
    </>
  ),
  typewriter: <span className="cursor-blink">most founders get this wrong</span>,
  outline: <>MOST FOUNDERS GET THIS WRONG</>,
  glow: <>most founders get this wrong</>,
  boxed: <>Most founders get this wrong</>,
  "lower-third": <>Most founders get this wrong</>,
  "two-line": (
    <>
      most founders <b>get this</b>
      <br />
      wrong
    </>
  ),
  "emoji-pop": (
    <>
      MOST <b>FOUNDERS</b> 🚀 GET THIS WRONG
    </>
  ),
  handwritten: <>most founders get this wrong</>,
};

/** Static CSS mock of a caption style on a dark frame. */
export function CaptionStyleCard({ id, name, description, selected, onSelect, compact }: { id: string; name: string; description?: string; selected?: boolean; onSelect?: () => void; compact?: boolean }) {
  const position = id === "clean-minimal" || id === "karaoke" || id === "typewriter" || id === "outline" || id === "boxed" || id === "lower-third" || id === "two-line" || id === "handwritten" ? "items-end pb-5" : "items-center";
  const Comp = onSelect ? "button" : "div";
  return (
    <Comp type={onSelect ? "button" : undefined} onClick={onSelect} className={cn("group relative overflow-hidden rounded-xl border text-left transition-colors", selected ? "border-accent" : "border-border hover:border-white/25")}>
      <div className={cn("relative flex w-full justify-center bg-[radial-gradient(60%_80%_at_50%_30%,#2a2a3a,#0b0b0f)] px-4", compact ? "aspect-[4/3]" : "aspect-video", position)} style={{ fontSize: compact ? 15 : 18 }}>
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(0deg, rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className={cn("cap-base relative max-w-full text-center", `cap-${id}`)}>{SAMPLE[id] ?? name}</div>
      </div>
      {!compact && (
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{name}</div>
            {description && <div className="mt-0.5 line-clamp-2 text-[11px] text-muted">{description}</div>}
          </div>
          {selected && (
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-black">
              <Check className="h-3 w-3" />
            </div>
          )}
        </div>
      )}
      {compact && <div className="px-2.5 py-2 text-xs font-medium">{name}</div>}
    </Comp>
  );
}
