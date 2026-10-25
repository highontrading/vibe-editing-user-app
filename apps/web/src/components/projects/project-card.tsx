"use client";
import Link from "next/link";
import { Archive, ArchiveRestore, Copy, Loader2, MoreHorizontal, Pencil, Trash2, Wand2 } from "lucide-react";
import { VideoThumb } from "@/components/media/video-thumb";
import { Badge } from "@/components/ui/card";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { cn, formatDuration, timeAgo } from "@/lib/utils";
import { PLATFORM_OPTIONS, PROJECT_STATUS_META } from "@/lib/options";
import type { ProjectDTO } from "@/lib/types";

export type ProjectAction = "rename" | "duplicate" | "archive" | "unarchive" | "delete" | "remix";

export function ProjectStatusPill({ status, message }: { status: ProjectDTO["status"]; message?: string | null }) {
  const meta = PROJECT_STATUS_META[status] ?? PROJECT_STATUS_META.DRAFTING!;
  return (
    <Badge tone={meta.tone} title={message ?? undefined} className="gap-1">
      {meta.busy && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {meta.label}
    </Badge>
  );
}

export function ProjectCard({ project, onAction, className }: { project: ProjectDTO; onAction?: (action: ProjectAction, project: ProjectDTO) => void; className?: string }) {
  const platform = PLATFORM_OPTIONS.find((p) => p.value === project.platform)?.label ?? project.platform;
  const aspectClass = project.aspect === "9:16" ? "aspect-[9/16]" : project.aspect === "1:1" ? "aspect-square" : project.aspect === "4:5" ? "aspect-[4/5]" : "aspect-video";
  return (
    <div className={cn("group relative", className)}>
      <Link href={`/editor/${project.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-xl">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-transparent bg-bg-3 card-hover">
          <div className="absolute inset-0 flex items-center justify-center bg-bg-3">
            <VideoThumb thumbUrl={project.thumbUrl} seed={project.id} title={project.title} aspect={aspectClass} className={cn("rounded-none", project.aspect === "16:9" ? "w-full" : "h-full w-auto")} hoverPlay={false} durationMs={project.aspect === "16:9" ? project.durationMs : null} />
          </div>
          <div className="absolute left-2 top-2 flex gap-1">
            <ProjectStatusPill status={project.status} message={project.statusMessage} />
          </div>
          {project.aspect !== "16:9" && project.durationMs ? <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{formatDuration(project.durationMs)}</div> : null}
        </div>
      </Link>
      <div className="mt-2.5 flex items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <Link href={`/editor/${project.id}`} className="block truncate text-sm font-medium hover:underline underline-offset-4">
            {project.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <Badge className="px-1.5 py-0">{project.aspect}</Badge>
            <Badge className="px-1.5 py-0">{platform}</Badge>
            {project.recipe && <span className="truncate">· {project.recipe.title}</span>}
            <span>· {timeAgo(project.updatedAt)}</span>
          </div>
        </div>
        {onAction && (
          <Menu
            trigger={
              <button className="rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-white/8 hover:text-fg focus:opacity-100 group-hover:opacity-100" aria-label="Project actions">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          >
            <MenuItem icon={Pencil} onClick={() => onAction("rename", project)}>
              Rename
            </MenuItem>
            <MenuItem icon={Copy} onClick={() => onAction("duplicate", project)}>
              Duplicate
            </MenuItem>
            <MenuItem icon={Wand2} onClick={() => onAction("remix", project)}>
              Remix into another recipe
            </MenuItem>
            <MenuSeparator />
            {project.archived ? (
              <MenuItem icon={ArchiveRestore} onClick={() => onAction("unarchive", project)}>
                Restore
              </MenuItem>
            ) : (
              <MenuItem icon={Archive} onClick={() => onAction("archive", project)}>
                Archive
              </MenuItem>
            )}
            <MenuItem icon={Trash2} danger onClick={() => onAction("delete", project)}>
              Delete
            </MenuItem>
          </Menu>
        )}
      </div>
    </div>
  );
}
