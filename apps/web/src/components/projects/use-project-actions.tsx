"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/utils";
import type { ProjectDTO } from "@/lib/types";
import { ConfirmDialog, RemixDialog, RenameDialog } from "./project-dialogs";
import type { ProjectAction } from "./project-card";

/**
 * Shared project mutation handling (optimistic) + the dialogs. `mutate` receives
 * an updater for the current list so callers (SWR pages, home tab) stay in sync.
 */
export function useProjectActions(mutate: (fn: (list: ProjectDTO[]) => ProjectDTO[], revalidate?: boolean) => void) {
  const router = useRouter();
  const [renaming, setRenaming] = React.useState<ProjectDTO | null>(null);
  const [deleting, setDeleting] = React.useState<ProjectDTO | null>(null);
  const [remixing, setRemixing] = React.useState<ProjectDTO | null>(null);

  const onAction = React.useCallback(
    async (action: ProjectAction, p: ProjectDTO) => {
      switch (action) {
        case "rename":
          return setRenaming(p);
        case "delete":
          return setDeleting(p);
        case "remix":
          return setRemixing(p);
        case "archive":
        case "unarchive": {
          const archived = action === "archive";
          mutate((list) => list.map((x) => (x.id === p.id ? { ...x, archived } : x)), false);
          try {
            await api(`/api/projects/${p.id}/meta`, { method: "PATCH", json: { archived } });
            toast.success(archived ? "Project archived" : "Project restored", p.title);
          } catch (e) {
            toast.error("Could not update project", e instanceof Error ? e.message : undefined);
          } finally {
            mutate((l) => l, true);
          }
          return;
        }
        case "duplicate": {
          try {
            const copy = await api<ProjectDTO>(`/api/projects/${p.id}/meta`, { method: "POST", json: {} });
            mutate((list) => [copy, ...list], true);
            toast.success("Project duplicated", copy.title);
          } catch (e) {
            toast.error("Could not duplicate", e instanceof Error ? e.message : undefined);
          }
          return;
        }
      }
    },
    [mutate],
  );

  const dialogs = (
    <>
      <RenameDialog project={renaming} onClose={() => setRenaming(null)} onRenamed={(np) => mutate((list) => list.map((x) => (x.id === np.id ? np : x)), true)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete project?"
        description={
          <>
            “{deleting?.title}” and its footage, versions and exports will be removed from storage. This cannot be undone.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return;
          const id = deleting.id;
          mutate((list) => list.filter((x) => x.id !== id), false);
          try {
            await api(`/api/projects/${id}/meta`, { method: "DELETE" });
            toast.success("Project deleted");
          } catch (e) {
            toast.error("Could not delete", e instanceof Error ? e.message : undefined);
          } finally {
            mutate((l) => l, true);
            router.refresh();
          }
        }}
      />
      <RemixDialog project={remixing} onClose={() => setRemixing(null)} />
    </>
  );
  return { onAction, dialogs };
}
