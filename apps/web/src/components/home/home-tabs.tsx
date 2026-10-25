"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, FolderOpen, Upload } from "lucide-react";
import useSWR from "swr";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { RecipeRow, groupRecipes } from "@/components/recipes/recipe-row";
import { ProjectCard } from "@/components/projects/project-card";
import { useProjectActions } from "@/components/projects/use-project-actions";
import { RECIPE_CATEGORIES } from "@/lib/options";
import { fetcher } from "@/lib/utils";
import type { ProjectDTO, RecipeDTO } from "@/lib/types";

export function HomeTabs({ recipes, projects: initialProjects }: { recipes: RecipeDTO[]; projects: ProjectDTO[] }) {
  // Deterministic first render (SSR), then restore the viewer's last tab.
  const [tab, setTabState] = React.useState<"recipes" | "projects">(initialProjects.length ? "projects" : "recipes");
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("vibe.homeTab");
      if (saved === "recipes" || saved === "projects") setTabState(saved);
    } catch {}
  }, []);
  const setTab = (t: "recipes" | "projects") => {
    setTabState(t);
    try {
      localStorage.setItem("vibe.homeTab", t);
    } catch {}
  };
  const { data, mutate } = useSWR<{ projects: ProjectDTO[] }>("/api/projects?archived=0&limit=12", fetcher, { fallbackData: { projects: initialProjects }, refreshInterval: 15000 });
  const projects = data?.projects ?? initialProjects;
  const { onAction, dialogs } = useProjectActions((fn, revalidate) => mutate((cur) => ({ projects: fn(cur?.projects ?? []) }), { revalidate: revalidate ?? false }));
  const featured = recipes.filter((r) => r.isFeatured);
  const mine = recipes.filter((r) => !r.isPublic);
  const groups = groupRecipes(
    recipes.filter((r) => r.isPublic),
    RECIPE_CATEGORIES,
  );

  return (
    <div className="rounded-t-3xl border-t border-border bg-bg-2/40 px-8 pb-16 pt-6 md:px-12">
      <div className="flex items-center justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "recipes", label: "Recipes" },
            { value: "projects", label: `Your projects${projects.length ? ` · ${projects.length}` : ""}` },
          ]}
        />
        {tab === "recipes" ? (
          <Link href="/recipes" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
            Browse all <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link href="/projects" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
            All projects <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {tab === "recipes" ? (
        <div className="mt-6 flex flex-col gap-9">
          <RecipeRow
            title="Remix a recipe"
            recipes={featured.length ? featured : recipes.slice(0, 8)}
            height={230}
            leading={
              <Link href="/recipes" className="flex h-full w-[160px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted transition-colors hover:border-white/30 hover:text-fg">
                <Upload className="h-4 w-4" />
                <span className="text-xs">Upload a reference</span>
                <span className="text-[10px] text-muted">coming soon</span>
              </Link>
            }
          />
          {mine.length > 0 && <RecipeRow title="Your recipes" recipes={mine} height={180} />}
          <div className="grid grid-cols-1 gap-x-10 gap-y-9 xl:grid-cols-2">
            {groups.map((g) => (
              <RecipeRow key={g.category} title={g.category} recipes={g.recipes} height={180} />
            ))}
          </div>
          {!recipes.length && <EmptyState title="No recipes yet" description="Run the database seed to load the built-in recipes." compact />}
        </div>
      ) : (
        <div className="mt-6">
          {projects.length ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onAction={onAction} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="No projects yet"
              description="Describe a video above or drop some footage to create your first project."
              compact
              action={
                <Button variant="outline" onClick={() => document.querySelector<HTMLTextAreaElement>("textarea")?.focus()}>
                  Start with a brief
                </Button>
              }
            />
          )}
          {dialogs}
        </div>
      )}
    </div>
  );
}
