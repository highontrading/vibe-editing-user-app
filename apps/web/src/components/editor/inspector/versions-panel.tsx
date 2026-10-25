"use client";
import * as React from "react";
import { Bot, User, Sparkles, Upload, Eye, RotateCcw, GitBranch, Loader2, Check } from "lucide-react";
import type { EditScript } from "@vibe/edl";
import { api, cn, timeAgo } from "@/lib/utils";
import { useEditor } from "@/lib/editor/store";
import type { VersionView, VersionWithScript } from "@/lib/editor/types";
import { toast } from "@/components/ui/toast";

const SOURCE: Record<VersionView["source"], { icon: React.ComponentType<{ className?: string }>; label: string; tone: string }> = {
  AGENT: { icon: Bot, label: "AI", tone: "text-accent border-accent/30 bg-accent/10" },
  USER: { icon: User, label: "You", tone: "text-accent-2 border-accent-2/30 bg-accent-2/10" },
  RECIPE: { icon: Sparkles, label: "Recipe", tone: "text-success border-success/30 bg-success/10" },
  IMPORT: { icon: Upload, label: "Import", tone: "text-muted border-border bg-bg-3" },
};

export function VersionsPanel() {
  const versions = useEditor((s) => s.versions);
  const currentVersionId = useEditor((s) => s.currentVersionId);
  const previewVersion = useEditor((s) => s.previewVersion);
  const projectId = useEditor((s) => s.projectId);
  const refreshVersions = useEditor((s) => s.refreshVersions);
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!versions.length) void refreshVersions();
  }, [versions.length, refreshVersions]);

  const preview = async (v: VersionView) => {
    const st = useEditor.getState();
    if (v.id === st.currentVersionId) return st.setPreviewVersion(null);
    if (st.previewVersion?.id === v.id) return st.setPreviewVersion(null);
    setBusy(`p:${v.id}`);
    try {
      const full = await api<VersionWithScript>(`/api/projects/${projectId}/versions/${v.id}`);
      st.setPreviewVersion(full);
    } catch (e) {
      toast.error("Couldn't load version", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const restore = async (v: VersionView, label?: string) => {
    setBusy(`r:${v.id}`);
    try {
      await useEditor.getState().flush();
      const res = await api<{ version: VersionView; script: EditScript }>(`/api/projects/${projectId}/versions/${v.id}/restore`, { method: "POST", json: label ? { label } : {} });
      useEditor.getState().adoptScript(res.script, res.version);
      toast.success(label ? "Branched from that version" : "Version restored");
    } catch (e) {
      toast.error("Couldn't restore", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col p-2">
      <div className="px-1 pb-2 text-[10px] text-muted">Every change is a version. Click one to preview it; restore to continue from it.</div>
      {versions.length === 0 && <div className="p-4 text-center text-xs text-muted">No versions yet.</div>}
      <ol className="flex flex-col gap-1">
        {versions.map((v, i) => {
          const isCurrent = v.id === currentVersionId;
          const isPreview = previewVersion?.id === v.id;
          const src = SOURCE[v.source];
          return (
            <li key={v.id} className={cn("group rounded-lg border p-2 transition-colors", isPreview ? "border-accent bg-accent/10" : isCurrent ? "border-success/40 bg-success/5" : "border-border bg-bg-2 hover:border-white/20")}>
              <button type="button" onClick={() => preview(v)} className="flex w-full items-start gap-2 text-left">
                <div className={cn("relative h-10 w-7 shrink-0 overflow-hidden rounded-[4px] border border-black/40", `bg-[hsl(${(i * 47) % 360},30%,28%)]`)} style={{ background: `linear-gradient(160deg, hsl(${(i * 47 + 200) % 360},35%,30%), hsl(${(i * 47 + 260) % 360},35%,14%))` }}>
                  {busy === `p:${v.id}` ? <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" /> : isCurrent ? <Check className="absolute inset-0 m-auto h-3 w-3 text-white" /> : isPreview ? <Eye className="absolute inset-0 m-auto h-3 w-3 text-white" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("inline-flex items-center gap-0.5 rounded border px-1 py-px text-[9px] font-medium", src.tone)}><src.icon className="h-2.5 w-2.5" /> {src.label}</span>
                    <span className="text-[10px] text-muted">{timeAgo(v.createdAt)}</span>
                    {isCurrent && <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-success">current</span>}
                    {isPreview && <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-accent">previewing</span>}
                  </div>
                  <div className="mt-0.5 truncate text-xs font-medium" title={v.label ?? undefined}>{v.label ?? "Edit"}</div>
                  <div className="truncate text-[10px] text-muted">{v.summary}</div>
                </div>
              </button>
              {!isCurrent && (
                <div className="mt-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100" style={isPreview ? { opacity: 1 } : undefined}>
                  <button type="button" disabled={!!busy} onClick={() => restore(v)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-bg-3 py-1 text-[10px] hover:border-accent/50 hover:text-fg disabled:opacity-50">
                    {busy === `r:${v.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => restore(v, `Branch from ${v.label ?? v.summary}`.slice(0, 120))} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-bg-3 py-1 text-[10px] hover:border-accent/50 hover:text-fg disabled:opacity-50" title="Continue from here as a new line of edits">
                    <GitBranch className="h-3 w-3" /> Branch from here
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
