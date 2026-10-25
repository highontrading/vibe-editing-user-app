"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Undo2, Redo2, Download, Share2, BookmarkPlus, PanelLeft, PanelRight, PanelBottom, Loader2, Check, AlertTriangle, Sparkles, Cloud, CloudOff } from "lucide-react";
import { PLATFORM_PRESETS, type Platform } from "@vibe/edl";
import { cn, api } from "@/lib/utils";
import { useEditor } from "@/lib/editor/store";
import type { ProjectStatus } from "@/lib/editor/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { IconButton } from "./panel";
import type { Stage } from "./editor";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFTING: "Drafting",
  ANALYZING: "Understanding footage",
  PLANNING: "Planning",
  PLAN_READY: "Plan ready",
  BUILDING: "Building draft",
  READY: "Ready",
  EXPORTING: "Exporting",
  FAILED: "Something went wrong",
};

export function TopBar({ stage }: { stage: Stage }) {
  const project = useEditor((s) => s.project);
  const undoLen = useEditor((s) => s.undoStack.length);
  const redoLen = useEditor((s) => s.redoStack.length);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const saving = useEditor((s) => s.saving);
  const pending = useEditor((s) => !!s.pending);
  const chatOpen = useEditor((s) => s.chatOpen);
  const inspectorOpen = useEditor((s) => s.inspectorOpen);
  const timelineOpen = useEditor((s) => s.timelineOpen);
  const exportPanelOpen = useEditor((s) => s.exportPanelOpen);
  const exportsCount = useEditor((s) => s.project?.exportCount ?? 0);
  const set = useEditor((s) => s.set);
  const script = useEditor((s) => s.script);

  if (!project) return <div className="h-12 border-b border-border" />;

  const activeJob = project.jobs.find((j) => j.status === "RUNNING") ?? project.jobs.find((j) => j.status === "QUEUED");
  const busy = ["ANALYZING", "PLANNING", "BUILDING", "EXPORTING"].includes(project.status) && (!!activeJob || project.status !== "EXPORTING");
  const message = activeJob?.message ?? project.statusMessage;
  const aspect = script ? `${script.output.width}×${script.output.height}` : project.aspect;
  const platform = PLATFORM_PRESETS[(script?.meta.platform ?? project.platform) as Platform]?.label ?? project.platform;

  const saveRecipe = async () => {
    const title = window.prompt("Name this recipe", project.plan?.title ?? project.title);
    if (!title) return;
    try {
      await api(`/api/projects/${project.id}/recipe`, { method: "POST", json: { title } });
      toast.success("Recipe saved", "Find it under Recipes → Yours.");
    } catch (e) {
      toast.error("Couldn't save recipe", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-bg px-2">
      <Link href="/projects" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-white/8 hover:text-fg" aria-label="Back to projects">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex min-w-0 items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
        <TitleEditor projectId={project.id} title={project.title} />
      </div>

      <div className="ml-1 flex items-center gap-1.5">
        <StatusPill status={project.status} busy={busy} message={message ?? null} progress={activeJob?.progress} />
        <span className="hidden items-center gap-1 lg:flex">
          <Badge>{project.aspect}</Badge>
          <Badge>{platform}</Badge>
          {script && <Badge mono>{aspect}</Badge>}
        </span>
      </div>

      <div className="flex-1" />

      {stage === "editor" && (
        <>
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-2 p-0.5">
            <IconButton title="Undo (⌘Z)" onClick={undo} disabled={undoLen === 0}>
              <Undo2 className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton title="Redo (⇧⌘Z)" onClick={redo} disabled={redoLen === 0}>
              <Redo2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
          <SaveState saving={saving} pending={pending} />
          <div className="mx-1 h-5 w-px bg-border" />
          <div className="flex items-center gap-0.5">
            <IconButton title="Toggle chat (\\)" active={chatOpen} onClick={() => set({ chatOpen: !chatOpen })}>
              <PanelLeft className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton title="Toggle timeline ([)" active={timelineOpen} onClick={() => set({ timelineOpen: !timelineOpen })}>
              <PanelBottom className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton title="Toggle inspector (])" active={inspectorOpen} onClick={() => set({ inspectorOpen: !inspectorOpen })}>
              <PanelRight className="h-3.5 w-3.5" />
            </IconButton>
          </div>
          <div className="mx-1 h-5 w-px bg-border" />
        </>
      )}
      {(stage === "editor" || project.plan) && (
        <Button size="sm" variant="ghost" onClick={saveRecipe} title="Save this project's plan as a reusable recipe">
          <BookmarkPlus className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Save as recipe</span>
        </Button>
      )}
      {stage === "editor" && (
        <>
          <Button size="sm" variant={exportPanelOpen ? "secondary" : "ghost"} onClick={() => set({ exportPanelOpen: !exportPanelOpen })} title="Exports and share links">
            <Share2 className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Share</span>
            {exportsCount > 0 && <span className="rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums">{exportsCount}</span>}
          </Button>
          <Button size="sm" variant="accent" onClick={() => set({ exportOpen: true })} className="ml-1">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </>
      )}
    </header>
  );
}

function Badge({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <span className={cn("rounded-md border border-border bg-bg-2 px-1.5 py-0.5 text-[10px] font-medium text-muted", mono && "font-mono")}>{children}</span>;
}

function SaveState({ saving, pending }: { saving: boolean; pending: boolean }) {
  return (
    <span className="hidden min-w-[64px] items-center gap-1 text-[10px] text-muted md:flex" title={saving ? "Saving a new version" : pending ? "Edits will be saved shortly" : "All edits saved as versions"}>
      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : pending ? <CloudOff className="h-3 w-3" /> : <Cloud className="h-3 w-3 text-success/80" />}
      {saving ? "Saving" : pending ? "Unsaved" : "Saved"}
    </span>
  );
}

export function StatusPill({ status, busy, message, progress, className }: { status: ProjectStatus; busy: boolean; message: string | null; progress?: number; className?: string }) {
  const tone = status === "FAILED" ? "border-danger/40 bg-danger/10 text-danger" : status === "READY" ? "border-success/30 bg-success/10 text-success" : busy ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-bg-2 text-muted";
  return (
    <span className={cn("inline-flex max-w-[360px] items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", tone, className)} title={message ?? undefined}>
      {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : status === "FAILED" ? <AlertTriangle className="h-3 w-3 shrink-0" /> : status === "READY" ? <Check className="h-3 w-3 shrink-0" /> : null}
      <span className="shrink-0">{STATUS_LABEL[status]}</span>
      {busy && message && <span className="truncate font-normal opacity-80">· {message}</span>}
      {busy && typeof progress === "number" && progress > 0 && <span className="shrink-0 font-mono text-[10px] opacity-80">{progress}%</span>}
    </span>
  );
}

function TitleEditor({ projectId, title }: { projectId: string; title: string }) {
  const [value, setValue] = React.useState(title);
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    if (!editing) setValue(title);
  }, [title, editing]);
  const commit = async () => {
    setEditing(false);
    const next = value.trim();
    if (!next || next === title) return setValue(title);
    try {
      const view = await api<import("@/lib/editor/types").ProjectView>(`/api/projects/${projectId}`, { method: "PATCH", json: { title: next } });
      useEditor.getState().syncProject(view);
    } catch (e) {
      toast.error("Couldn't rename", e instanceof Error ? e.message : undefined);
      setValue(title);
    }
  };
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValue(title);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-7 w-[220px] truncate rounded-md border border-transparent bg-transparent px-1.5 text-sm font-medium text-fg outline-none transition-colors hover:border-border focus:border-accent/50 focus:bg-bg-2"
      aria-label="Project title"
    />
  );
}
