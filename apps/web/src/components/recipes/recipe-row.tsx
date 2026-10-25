"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RecipeCard } from "./recipe-card";
import type { RecipeDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RecipeRow({ title, recipes, height = 220, className, leading }: { title: React.ReactNode; recipes: RecipeDTO[]; height?: number; className?: string; leading?: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = React.useState(false);
  const [canRight, setCanRight] = React.useState(false);
  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);
  React.useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [update, recipes.length]);
  const scrollBy = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * Math.max(300, (ref.current?.clientWidth ?? 600) * 0.8), behavior: "smooth" });
  if (!recipes.length) return null;
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {(canLeft || canRight) && (
          <div className="flex items-center gap-1">
            <button onClick={() => scrollBy(-1)} disabled={!canLeft} className="rounded-full border border-border p-1 text-muted hover:text-fg disabled:opacity-30" aria-label="Scroll left">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => scrollBy(1)} disabled={!canRight} className="rounded-full border border-border p-1 text-muted hover:text-fg disabled:opacity-30" aria-label="Scroll right">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div ref={ref} className="no-scrollbar flex gap-3 overflow-x-auto pb-1" style={{ height: height + 4 }}>
        {leading}
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} variant="row" height={height} />
        ))}
      </div>
    </section>
  );
}

/** Rows grouped by category, in a stable order. */
export function groupRecipes(recipes: RecipeDTO[], order: readonly string[]): { category: string; recipes: RecipeDTO[] }[] {
  const map = new Map<string, RecipeDTO[]>();
  for (const r of recipes) map.set(r.category, [...(map.get(r.category) ?? []), r]);
  const cats = Array.from(map.keys()).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });
  return cats.map((c) => ({ category: c, recipes: map.get(c)! }));
}
