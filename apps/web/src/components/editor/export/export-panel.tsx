"use client";
import * as React from "react";
import useSWR from "swr";
import { Download, Link2, Copy, Check, Loader2, AlertTriangle, X, FileText, Clock, Share2 } from "lucide-react";
import { aspectOf } from "@vibe/edl";
import { api, cn, fetcher, formatBytes, timeAgo } from "@/lib/utils";
import { useEditor } from "@/lib/editor/store";
import type { ExportView } from "@/lib/editor/types";
import { toast } from "@/components/ui/toast";
import { IconButton } from "../panel";

export function ExportPanel() {
  const projectId = useEditor((s) => s.projectId);
  const exports = useEditor((s) => s.exports);
  const setExports = useEditor((s) => s.setExports);
  const set = useEditor((s) => s.set);
  const active = exports.some((e) => e.status === "QUEUED" || e.status === "RUNNING");
  const { isLoading } = useSWR<{ exports: ExportView[] }>(`/api/projects/${projectId}/exports`, fetcher, {
    refreshInterval: active ? 2000 : 0,
    onSuccess: (d) => setExports(d.exports),
  });
  return (
    <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-bg-2/95 shadow-2xl backdrop-blur">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"><Share2 className="h-3 w-3" /> Exports</div>
        <IconButton title="Close" onClick={() => set({ exportPanelOpen: false })}><X className="h-3.5 w-3.5" /></IconButton>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {exports.length === 0 && isLoading && (
          <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading exports…</div>
        )}
        {exports.length === 0 && !isLoading && (
          <div className="p-4 text-center text-xs text-muted">
            No exports yet.
            <button type="button" onClick={() => set({ exportOpen: true, exportPanelOpen: false })} className="ml-1 text-accent hover:underline">Export your edit</button>
          </div>
        )}
        <ul className="flex flex-col gap-1.5">
          {exports.map((e) => (
            <ExportRow key={e.id} exp={e} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function ExportRow({ exp }: { exp: ExportView }) {
  const projectId = useEditor((s) => s.projectId);
  const [copied, setCopied] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const running = exp.status === "QUEUED" || exp.status === "RUNNING";
  const progress = exp.job?.progress ?? 0;
  const aspect = aspectOf(exp.width, exp.height);

  const share = async () => {
    setSharing(true);
    try {
      const res = await api<{ shareUrl: string; shareToken: string }>(`/api/projects/${projectId}/exports/${exp.id}/share`, { method: "POST" });
      useEditor.getState().setExports(useEditor.getState().exports.map((x) => (x.id === exp.id ? { ...x, shareUrl: res.shareUrl, shareToken: res.shareToken } : x)));
      await copy(res.shareUrl);
    } catch (e) {
      toast.error("Couldn't create a share link", e instanceof Error ? e.message : undefined);
    } finally {
      setSharing(false);
    }
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Link copied");
    } catch {
      toast.info("Share link", url);
    }
  };

  return (
    <li className="rounded-lg border border-border bg-bg-3 p-2">
      <div className="flex items-start gap-2">
        <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-black/60">
          {exp.thumbUrl ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${exp.thumbUrl})` }} /> : <div className="absolute inset-0 flex items-center justify-center text-muted">{running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : exp.status === "FAILED" ? <AlertTriangle className="h-3.5 w-3.5 text-danger" /> : <Check className="h-3.5 w-3.5 text-success" />}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-medium">{aspect} · {exp.quality === "4k" ? "4K" : exp.quality}</span>
            <span className="rounded border border-border px-1 py-px text-[9px] uppercase text-muted">{exp.preset}</span>
            {exp.watermark && <span className="rounded border border-accent/30 bg-accent/10 px-1 py-px text-[9px] text-accent">watermark</span>}
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted"><Clock className="h-3 w-3" /> {timeAgo(exp.createdAt)}</span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted">
            {running ? (exp.job?.message ?? (exp.status === "QUEUED" ? "Waiting for a render worker…" : "Rendering…")) : exp.status === "FAILED" ? (exp.job?.error ?? "Render failed") : `${exp.width}×${exp.height}${exp.sizeBytes ? ` · ${formatBytes(exp.sizeBytes)}` : ""}${exp.burnCaptions ? " · captions burned in" : " · .srt"}`}
          </div>
          {running && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.max(3, progress)}%` }} />
            </div>
          )}
        </div>
      </div>
      {!running && exp.status !== "FAILED" && (
        <div className="mt-2 flex flex-wrap gap-1">
          <a href={exp.downloadUrl ?? "#"} className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-bg-2 px-2 py-1 text-[10px] font-medium hover:border-accent/50", !exp.downloadUrl && "pointer-events-none opacity-40")} download>
            <Download className="h-3 w-3" /> Download
          </a>
          <a href={exp.srtUrl ? `/api/projects/${projectId}/exports/${exp.id}/download?srt=1` : "#"} className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-bg-2 px-2 py-1 text-[10px] font-medium hover:border-accent/50", !exp.srtUrl && "pointer-events-none opacity-40")} title={exp.srtUrl ? "Download captions" : "No SRT for this export"}>
            <FileText className="h-3 w-3" /> SRT
          </a>
          {exp.shareUrl ? (
            <button type="button" onClick={() => copy(exp.shareUrl!)} className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy link
            </button>
          ) : (
            <button type="button" disabled={sharing} onClick={share} className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-2 px-2 py-1 text-[10px] font-medium hover:border-accent/50">
              {sharing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />} Share link
            </button>
          )}
        </div>
      )}
    </li>
  );
}
