"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { VideoThumb } from "@/components/media/video-thumb";
import { Badge } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RecipeDTO } from "@/lib/types";

/** Row cards share a height; the width follows the recipe's first size (like the reference). */
export function rowWidthFor(sizes: string[], height = 220) {
  const s = sizes[0] ?? "9:16";
  const ratio = s === "16:9" ? 16 / 9 : s === "1:1" ? 1 : s === "4:5" ? 4 / 5 : 9 / 16;
  return Math.round(height * ratio);
}

export function RecipeCard({ recipe, variant = "row", height = 220, className }: { recipe: RecipeDTO; variant?: "row" | "grid"; height?: number; className?: string }) {
  const targetMs = (recipe.defaults as { targetDurationMs?: number }).targetDurationMs;
  const content = (
    <>
      <VideoThumb
        thumbUrl={recipe.previewUrl && !/\.(mp4|webm|mov)(\?|$)/i.test(recipe.previewUrl) ? recipe.previewUrl : null}
        previewUrl={recipe.previewUrl && /\.(mp4|webm|mov)(\?|$)/i.test(recipe.previewUrl) ? recipe.previewUrl : null}
        seed={recipe.slug}
        title={recipe.title}
        durationMs={targetMs}
        aspect={variant === "row" ? "h-full" : recipe.sizes[0] === "16:9" ? "aspect-video" : recipe.sizes[0] === "1:1" ? "aspect-square" : "aspect-[4/5]"}
        className={cn("card-hover border border-transparent", variant === "row" && "h-full")}
        badge={
          <>
            <Badge className="border-white/15 bg-black/60 text-white/90 backdrop-blur">{recipe.category}</Badge>
            {recipe.usesGenerative && (
              <Badge tone="accent" className="backdrop-blur">
                <Sparkles className="mr-1 h-2.5 w-2.5" /> AI
              </Badge>
            )}
          </>
        }
      >
        {!recipe.previewUrl && (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="font-display text-xl leading-tight text-white drop-shadow">{recipe.title}</div>
            <div className="mt-0.5 text-[11px] text-white/70">{recipe.sizes.join(" · ")}</div>
          </div>
        )}
        {recipe.previewUrl && (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="text-sm font-semibold text-white drop-shadow">{recipe.title}</div>
          </div>
        )}
      </VideoThumb>
      {variant === "grid" && (
        <div className="mt-2.5 px-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-medium">{recipe.title}</div>
            <div className="shrink-0 text-[11px] text-muted">{recipe.sizes.join(" · ")}</div>
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs text-muted">{recipe.description}</div>
          <div className="mt-1.5 truncate text-[11px] text-muted">
            <span className="text-fg/70">Bring:</span> {recipe.bring}
          </div>
        </div>
      )}
    </>
  );
  return (
    <Link href={`/recipes/${recipe.slug}`} className={cn("group block shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60", variant === "row" && "rounded-xl", className)} style={variant === "row" ? { width: rowWidthFor(recipe.sizes, height), height } : undefined} title={`${recipe.title} · Bring: ${recipe.bring}`}>
      {content}
    </Link>
  );
}
