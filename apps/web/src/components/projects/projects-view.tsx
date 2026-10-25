"use client";
import * as React from "react";
import Link from "next/link";
import { FolderOpen, Search, Sparkles } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "./project-card";
import { useProjectActions } from "./use-project-actions";
import { useProjects } from "@/lib/hooks";
import { PROJECT_STATUS_META } from "@/lib/options";
import type { ProjectDTO } from "@/lib/types";

type Sort = "updated" | "created" | "title" | "duration";

export function ProjectsView({ initial }: { initial: ProjectDTO[] }) {
  const [scope, setScope] = React.useState<"active" | "archived">("active");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [sort, setSort] = React.useState<Sort>("updated");
  const { data, isLoading, mutate } = useProjects({ archived: "all" });
  const all = data?.projects ?? initial;
  const { onAction, dialogs } = useProjectActions((fn, revalidate) => mutate((cur) => ({ projects: fn(cur?.projects ?? all) }), { revalidate: revalidate ?? false }));
  const archivedCount = all.filter((p) => p.archived).length;
  const list = all
    .filter((p) => (scope === "archived" ? p.archived : !p.archived))
    .filter((p) => status === "all" || p.status === status)
    .filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || (p.brief ?? "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "duration") return (b.durationMs ?? 0) - (a.durationMs ?? 0);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  return (
    <div className="px-8 py-10 md:px-12">
      <PageHeader
        eyebrow="Projects"
        title="Your projects"
        description="Every project remembers its chat, versions, exports and footage."
        actions={
          <Link href="/home">
            <Button variant="accent">
              <Sparkles className="h-4 w-4" /> New project
            </Button>
          </Link>
        }
      />
      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Tabs
            size="sm"
            value={scope}
            onChange={setScope}
            items={[
              { value: "active", label: "Active" },
              { value: "archived", label: `Archived${archivedCount ? ` · ${archivedCount}` : ""}` },
            ]}
          />
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="h-8 pl-9 text-xs" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 text-xs">
            <option value="all">All statuses</option>
            {Object.entries(PROJECT_STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 text-xs">
            <option value="updated">Last edited</option>
            <option value="created">Newest</option>
            <option value="title">Title A–Z</option>
            <option value="duration">Longest</option>
          </Select>
        </div>
      </div>

      <div className="mt-8">
        {isLoading && !all.length ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : list.length ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {list.map((p) => (
              <ProjectCard key={p.id} project={p} onAction={onAction} />
            ))}
          </div>
        ) : scope === "archived" ? (
          <EmptyState icon={FolderOpen} title="Nothing archived" description="Archived projects stay here until you restore or delete them." />
        ) : q || status !== "all" ? (
          <EmptyState icon={Search} title="No matches" description="Try a different search or filter." compact />
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Describe a video or drop footage on Home to create your first project. Or remix a recipe."
            action={
              <>
                <Link href="/home">
                  <Button variant="accent">
                    <Sparkles className="h-4 w-4" /> Start a project
                  </Button>
                </Link>
                <Link href="/recipes">
                  <Button variant="outline">Browse recipes</Button>
                </Link>
              </>
            }
          />
        )}
      </div>
      {dialogs}
    </div>
  );
}
