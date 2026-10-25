"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Upload, X } from "lucide-react";
import { cancelUpload, useUploads, type UploadItem } from "@/lib/upload";
import { Progress } from "@/components/ui/progress";
import { cn, formatBytes } from "@/lib/utils";

function statusText(it: UploadItem) {
  switch (it.status) {
    case "queued":
      return "Waiting";
    case "uploading":
      return `${it.progress}%${it.speedBps ? ` · ${formatBytes(it.speedBps)}/s` : ""}`;
    case "finishing":
      return "Finishing";
    case "processing":
      return "Uploaded · processing";
    case "done":
      return "Ready";
    case "error":
      return it.error || "Failed";
    case "cancelled":
      return "Cancelled";
  }
}

export function UploadTray() {
  const { items, collapsed, setCollapsed, remove, clearFinished } = useUploads();
  if (!items.length) return null;
  const active = items.filter((i) => ["queued", "uploading", "finishing"].includes(i.status));
  const processing = items.filter((i) => i.status === "processing");
  const total = items.reduce((a, b) => a + b.size, 0) || 1;
  const sent = items.reduce((a, b) => a + (b.size * (b.status === "done" || b.status === "processing" || b.status === "finishing" ? 100 : b.progress)) / 100, 0);
  const title = active.length ? `Uploading ${active.length} file${active.length === 1 ? "" : "s"}` : processing.length ? `Processing ${processing.length} file${processing.length === 1 ? "" : "s"}` : "Uploads";
  return (
    <AnimatePresence>
      <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.2 }} className="fixed bottom-4 right-4 z-[90] w-80 overflow-hidden rounded-2xl border border-border bg-bg-2 shadow-2xl">
        <button onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
          {active.length ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Upload className="h-4 w-4 text-muted" />}
          <div className="flex-1 text-sm font-medium">{title}</div>
          {collapsed ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
        </button>
        {active.length > 0 && <Progress value={(sent / total) * 100} className="rounded-none" />}
        {!collapsed && (
          <div className="max-h-64 overflow-auto border-t border-border">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2 last:border-0">
                <div className="shrink-0">
                  {it.status === "done" ? <CheckCircle2 className="h-4 w-4 text-success" /> : it.status === "error" || it.status === "cancelled" ? <AlertCircle className="h-4 w-4 text-danger" /> : <Loader2 className="h-4 w-4 animate-spin text-muted" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{it.name}</div>
                  <div className={cn("truncate text-[11px]", it.status === "error" ? "text-danger" : "text-muted")}>
                    {formatBytes(it.size)} · {statusText(it)}
                  </div>
                  {it.status === "uploading" && <Progress value={it.progress} className="mt-1 h-1" />}
                </div>
                <button
                  onClick={() => (["queued", "uploading", "finishing"].includes(it.status) ? cancelUpload(it.id) : remove(it.id))}
                  className="rounded p-1 text-muted hover:bg-white/8 hover:text-fg"
                  aria-label={["queued", "uploading"].includes(it.status) ? "Cancel" : "Dismiss"}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {items.some((i) => ["done", "error", "cancelled"].includes(i.status)) && (
              <button onClick={clearFinished} className="w-full px-3 py-2 text-left text-[11px] text-muted hover:text-fg">
                Clear finished
              </button>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
