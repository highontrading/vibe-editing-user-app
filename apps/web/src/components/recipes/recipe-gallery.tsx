"use client";
import * as React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Tabs, Chip } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { RecipeCard } from "./recipe-card";
import { RECIPE_CATEGORIES } from "@/lib/options";
import type { RecipeDTO } from "@/lib/types";

type Form = "all" | "short" | "long";

export function RecipeGallery({ recipes }: { recipes: RecipeDTO[] }) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [form, setForm] = React.useState<Form>("all");
  const [size, setSize] = React.useState<string>("all");
  const [scope, setScope] = React.useState<"all" | "mine">("all");
  const categories = Array.from(new Set([...RECIPE_CATEGORIES.filter((c) => recipes.some((r) => r.category === c)), ...recipes.map((r) => r.category)]));
  const filtered = recipes.filter((r) => {
    if (scope === "mine" && r.isPublic) return false;
    if (category !== "all" && r.category !== category) return false;
    if (size !== "all" && !r.sizes.includes(size)) return false;
    const target = (r.defaults as { targetDurationMs?: number }).targetDurationMs ?? 60000;
    if (form === "short" && target > 90_000) return false;
    if (form === "long" && target <= 90_000) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (![r.title, r.description, r.category, r.bring, ...r.tags].some((s) => s.toLowerCase().includes(needle))) return false;
    }
    return true;
  });
  const grouped = new Map<string, RecipeDTO[]>();
  for (const r of filtered) grouped.set(r.category, [...(grouped.get(r.category) ?? []), r]);

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes" className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            size="sm"
            value={form}
            onChange={setForm}
            items={[
              { value: "all", label: "All" },
              { value: "short", label: "Short-form" },
              { value: "long", label: "Long-form" },
            ]}
          />
          <Select value={size} onChange={(e) => setSize(e.target.value)} className="h-8 text-xs">
            <option value="all">All sizes</option>
            <option value="9:16">9:16 vertical</option>
            <option value="16:9">16:9 wide</option>
            <option value="1:1">1:1 square</option>
            <option value="4:5">4:5 feed</option>
          </Select>
          <Select value={scope} onChange={(e) => setScope(e.target.value as "all" | "mine")} className="h-8 text-xs">
            <option value="all">All recipes</option>
            <option value="mine">My recipes</option>
          </Select>
        </div>
      </div>
      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
        <Chip active={category === "all"} onClick={() => setCategory("all")} className="shrink-0">
          All types
        </Chip>
        {categories.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)} className="shrink-0">
            {c}
          </Chip>
        ))}
      </div>

      {filtered.length ? (
        <div className="mt-8 flex flex-col gap-10">
          {Array.from(grouped.entries()).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="mb-3 text-sm font-semibold">
                {cat} <span className="ml-1 text-xs font-normal text-muted">{list.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {list.map((r) => (
                  <RecipeCard key={r.id} recipe={r} variant="grid" />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={SlidersHorizontal} title="No recipes match" description="Try a different search or clear the filters." className="mt-8" compact />
      )}
    </div>
  );
}
