"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useRecipes } from "@/lib/hooks";
import { api, cn } from "@/lib/utils";
import { gradientFor } from "@/lib/options";
import type { ProjectDTO } from "@/lib/types";

export function RenameDialog({ project, onClose, onRenamed }: { project: ProjectDTO | null; onClose: () => void; onRenamed: (p: ProjectDTO) => void }) {
  const [title, setTitle] = React.useState(project?.title ?? "");
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => setTitle(project?.title ?? ""), [project]);
  return (
    <Dialog open={!!project} onClose={onClose} title="Rename project" width="max-w-sm">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!project || !title.trim()) return;
          setLoading(true);
          try {
            const p = await api<ProjectDTO>(`/api/projects/${project.id}/meta`, { method: "PATCH", json: { title: title.trim() } });
            onRenamed(p);
            toast.success("Renamed", p.title);
            onClose();
          } catch (err) {
            toast.error("Rename failed", err instanceof Error ? err.message : undefined);
          } finally {
            setLoading(false);
          }
        }}
        className="flex flex-col gap-3"
      >
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Delete", danger = true }: { open: boolean; onClose: () => void; onConfirm: () => Promise<void> | void; title: string; description?: React.ReactNode; confirmLabel?: string; danger?: boolean }) {
  const [loading, setLoading] = React.useState(false);
  return (
    <Dialog open={open} onClose={onClose} title={title} width="max-w-sm">
      {description && <p className="text-sm text-muted">{description}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          loading={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setLoading(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/** "Remix into another recipe": creates a new project from the same brief + footage with a different recipe. */
export function RemixDialog({ project, onClose }: { project: ProjectDTO | null; onClose: () => void }) {
  const router = useRouter();
  const { data } = useRecipes();
  const [slug, setSlug] = React.useState<string | null>(null);
  const [twist, setTwist] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const recipes = (data?.recipes ?? []).filter((r) => r.id !== project?.recipeId);
  return (
    <Dialog open={!!project} onClose={onClose} title={`Remix “${project?.title ?? ""}”`} width="max-w-2xl">
      <p className="text-sm text-muted">Pick a recipe. A new project is created with the same brief and footage, so the original stays untouched.</p>
      <div className="mt-4 grid max-h-[50vh] grid-cols-2 gap-2 overflow-auto pr-1 sm:grid-cols-3">
        {recipes.map((r) => (
          <button key={r.id} type="button" onClick={() => setSlug(r.slug)} className={cn("flex flex-col overflow-hidden rounded-xl border text-left transition-colors", slug === r.slug ? "border-accent" : "border-border hover:border-white/25")}>
            <div className="h-20 w-full" style={{ background: gradientFor(r.slug) }} />
            <div className="p-2.5">
              <div className="truncate text-sm font-medium">{r.title}</div>
              <div className="mt-1 flex items-center gap-1">
                <Badge className="px-1.5 py-0">{r.category}</Badge>
                <span className="text-[11px] text-muted">{r.sizes.join(" · ")}</span>
              </div>
            </div>
          </button>
        ))}
        {!data && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-white/5" />)}
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <Label>Optional twist</Label>
        <Textarea value={twist} onChange={(e) => setTwist(e.target.value)} placeholder="make it moodier, keep it under 30s…" className="min-h-[60px]" />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="accent"
          disabled={!slug}
          loading={loading}
          onClick={async () => {
            if (!project || !slug) return;
            setLoading(true);
            try {
              const assets = await api<{ assets: { id: string }[] }>(`/api/assets?projectId=${project.id}`);
              const created = await api<ProjectDTO>("/api/projects", { method: "POST", json: { brief: project.brief ?? "", aspect: "auto", recipeSlug: slug, twist: twist || undefined, targetDurationMs: project.targetDurationMs ?? 0, assetIds: assets.assets.map((a) => a.id) } });
              toast.success("Remix created", created.title);
              router.push(`/editor/${created.id}`);
            } catch (e) {
              toast.error("Could not remix", e instanceof Error ? e.message : undefined);
              setLoading(false);
            }
          }}
        >
          Create remix
        </Button>
      </div>
    </Dialog>
  );
}
