"use client";
const NO_JOBS: never[] = [];
import * as React from "react";
import { Check, X, Loader2, History, RotateCcw, Sparkles, AlertTriangle, Eye } from "lucide-react";
import type { CheckResult } from "@vibe/edl";
import { api, cn, timeAgo } from "@/lib/utils";
import { useEditor } from "@/lib/editor/store";
import type { MessageView, VersionWithScript, VersionView } from "@/lib/editor/types";
import { toast } from "@/components/ui/toast";
import { PlanCard } from "../states/plan-card";

export function ChatMessage({ message, isLast, onSuggestion }: { message: MessageView; isLast: boolean; onSuggestion: (s: string) => void }) {
  if (message.role === "USER") return <UserMessage message={message} />;
  if (message.role === "SYSTEM") return <div className="px-3 py-1 text-center text-[11px] text-muted">{message.content}</div>;
  return <AssistantMessage message={message} isLast={isLast} onSuggestion={onSuggestion} />;
}

function UserMessage({ message }: { message: MessageView }) {
  return (
    <div className="flex justify-end px-3 py-1.5">
      <div className="max-w-[88%] rounded-2xl rounded-br-md bg-white/10 px-3 py-2 text-[13px] leading-relaxed">{message.content}</div>
    </div>
  );
}

function AssistantMessage({ message, isLast, onSuggestion }: { message: MessageView; isLast: boolean; onSuggestion: (s: string) => void }) {
  const currentVersionId = useEditor((s) => s.currentVersionId);
  const previewVersion = useEditor((s) => s.previewVersion);
  const jobs = useEditor((s) => s.project?.jobs ?? NO_JOBS);
  const data = message.data ?? {};
  const pending = message.status === "pending";
  const error = message.status === "error";
  const job = data.jobId ? jobs.find((j) => j.id === data.jobId) : jobs.find((j) => j.type === "edit" && (j.status === "RUNNING" || j.status === "QUEUED"));
  const isCheckpoint = !!message.versionId;
  const isCurrent = message.versionId === currentVersionId;
  const isPreviewing = previewVersion?.id === message.versionId;
  const summary = Array.isArray(data.summary) ? data.summary : data.summary ? splitBullets(data.summary) : [];
  const opsCount = typeof data.ops === "number" ? data.ops : Array.isArray(data.ops) ? data.ops.length : data.opsCount;

  return (
    <div className="group px-3 py-1.5">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
          {pending ? <Loader2 className="h-3 w-3 animate-spin text-accent" /> : error ? <AlertTriangle className="h-3 w-3 text-danger" /> : <Sparkles className="h-3 w-3 text-accent" />}
        </div>
        <div className="min-w-0 flex-1">
          {pending ? (
            <div className="text-[13px] leading-relaxed text-muted">
              <span className="animate-pulse">{job?.message ?? (job?.status === "QUEUED" ? "Waiting for the editor…" : "Working on it…")}</span>
              {typeof job?.progress === "number" && job.progress > 0 && <span className="ml-1 font-mono text-[10px]">{job.progress}%</span>}
            </div>
          ) : (
            <>
              {message.content && <p className={cn("whitespace-pre-wrap text-[13px] leading-relaxed", error && "text-danger")}>{message.content}</p>}
              {error && data.error && <p className="mt-1 text-[11px] text-danger/80">{data.error}</p>}
              {data.plan && <PlanCard plan={data.plan} compact className="mt-2" />}
              {summary.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {summary.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" /> {s}
                    </li>
                  ))}
                </ul>
              )}
              {data.checks && data.checks.length > 0 && <ChecksList checks={data.checks} />}
              {(isCheckpoint || opsCount) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  {opsCount ? <span className="rounded-md border border-border bg-bg-2 px-1.5 py-0.5">{opsCount} change{opsCount === 1 ? "" : "s"}</span> : null}
                  {isCheckpoint && <Checkpoint versionId={message.versionId!} isCurrent={isCurrent} isPreviewing={isPreviewing} createdAt={message.createdAt} />}
                </div>
              )}
              {isLast && data.suggestions && data.suggestions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {data.suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => onSuggestion(s)} className="rounded-full border border-border bg-bg-2 px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-fg">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function splitBullets(s: string): string[] {
  const lines = s.split(/\n+/).map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  return lines.length > 1 ? lines : s.split(/(?<=[.;])\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
}

export function ChecksList({ checks, onFix }: { checks: CheckResult[]; onFix?: (c: CheckResult) => void }) {
  return (
    <ul className="mt-2 flex flex-col gap-0.5">
      {checks.map((c) => (
        <li key={c.id} className="flex items-center gap-1.5 text-[11px]">
          {c.ok ? <Check className="h-3 w-3 shrink-0 text-success" /> : <X className="h-3 w-3 shrink-0 text-danger" />}
          <span className={cn("min-w-0 flex-1 truncate", c.ok ? "text-muted" : "text-fg")} title={c.detail}>
            {c.label}
            {!c.ok && c.detail ? <span className="text-muted"> · {c.detail}</span> : null}
          </span>
          {!c.ok && c.fixable && onFix && (
            <button type="button" onClick={() => onFix(c)} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted hover:border-accent/50 hover:text-fg">
              Fix
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Checkpoint({ versionId, isCurrent, isPreviewing, createdAt }: { versionId: string; isCurrent: boolean; isPreviewing: boolean; createdAt: string }) {
  const [busy, setBusy] = React.useState<"preview" | "restore" | null>(null);
  const projectId = useEditor((s) => s.projectId);
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (isPreviewing) return useEditor.getState().setPreviewVersion(null);
          if (isCurrent) return;
          setBusy("preview");
          try {
            const v = await api<VersionWithScript>(`/api/projects/${projectId}/versions/${versionId}`);
            useEditor.getState().setPreviewVersion(v);
          } catch (e) {
            toast.error("Couldn't load that version", e instanceof Error ? e.message : undefined);
          } finally {
            setBusy(null);
          }
        }}
        className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition-colors", isPreviewing ? "border-accent/60 bg-accent/15 text-accent" : isCurrent ? "border-success/40 text-success" : "border-border bg-bg-2 hover:border-white/20 hover:text-fg")}
        title={isCurrent ? "This is the current version" : isPreviewing ? "Stop previewing" : "Preview this checkpoint"}
      >
        {busy === "preview" ? <Loader2 className="h-3 w-3 animate-spin" /> : isCurrent ? <Check className="h-3 w-3" /> : isPreviewing ? <Eye className="h-3 w-3" /> : <History className="h-3 w-3" />}
        {isCurrent ? "Current" : isPreviewing ? "Previewing" : "Checkpoint"} · {timeAgo(createdAt)}
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={async () => {
            setBusy("restore");
            try {
              const res = await api<{ version: VersionView; script: import("@vibe/edl").EditScript }>(`/api/projects/${projectId}/versions/${versionId}/restore`, { method: "POST", json: {} });
              useEditor.getState().adoptScript(res.script, res.version);
              toast.success("Version restored", "A new checkpoint was created.");
            } catch (e) {
              toast.error("Couldn't restore", e instanceof Error ? e.message : undefined);
            } finally {
              setBusy(null);
            }
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-2 px-1.5 py-0.5 hover:border-accent/50 hover:text-fg"
        >
          {busy === "restore" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore this version
        </button>
      )}
    </>
  );
}
