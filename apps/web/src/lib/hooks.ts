"use client";
import useSWR from "swr";
import { fetcher } from "./utils";
import type { AssetDTO, MeDTO, ProjectDTO, RecipeDTO } from "./types";

export function useProjects(params: { archived?: "0" | "1" | "all"; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.archived) qs.set("archived", params.archived);
  if (params.q) qs.set("q", params.q);
  return useSWR<{ projects: ProjectDTO[] }>(`/api/projects?${qs.toString()}`, fetcher, { revalidateOnFocus: true });
}

export function useAssets(params: Record<string, string | undefined> = {}, opts: { refreshInterval?: number } = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  return useSWR<{ assets: AssetDTO[]; folders: string[]; tags: string[]; total: number }>(`/api/assets?${qs.toString()}`, fetcher, { refreshInterval: opts.refreshInterval });
}

export function useRecipes(params: { mine?: boolean; category?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.mine) qs.set("mine", "1");
  if (params.category) qs.set("category", params.category);
  if (params.q) qs.set("q", params.q);
  return useSWR<{ recipes: RecipeDTO[] }>(`/api/recipes?${qs.toString()}`, fetcher);
}

export function useMe() {
  return useSWR<MeDTO & { usage: { used: number; quota: number; pct: number; resetsAt: string; remaining: number } }>("/api/me", fetcher);
}
