"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, MessageSquarePlus, RotateCcw, AlertTriangle } from "lucide-react";
import type { Plan } from "@vibe/edl";
import { api } from "@/lib/utils";
import { useEditor } from "@/lib/editor/store";
import type { ProjectView } from "@/lib/editor/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { PlanCard } from "./plan-card";

/** PLAN_READY: the user reviews, edits and approves the plan. */
export function PlanStage() {
  const project = useEditor((s) => s.project);
  const syncProject = useEditor((s) => s.syncProject);
  const [plan, setPlan] = React.useState<Plan | null>(project?.plan ?? null);
  const [brief, setBrief] = React.useState(project?.brief ?? "");
  const [change, setChange] = React.useState("");
  const [approving, setApproving] = React.useState(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (project?.plan && !plan) setPlan(project.plan);
  }, [project?.plan, plan]);
  React.useEffect(() => setBrief(project?.brief ?? ""), [project?.brief]);

  if (!project) return null;

  const persist = (nextPlan: Plan, nextBrief?: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api(`/api/projects/${project.id}/plan`, { method: "PATCH", json: { plan: nextPlan, ...(nextBrief !== undefined ? { brief: nextBrief } : {}) } }).catch((e) =>
        toast.error("Couldn't save plan changes", e instanceof Error ? e.message : undefined),
      );
    }, 600);
  };

  const onChange = (next: Plan) => {
    setPlan(next);
    persist(next);
  };

  const addChange = () => {
    const text = change.trim();
    if (!text || !plan) return;
    const nextBrief = `${brief.trim()}\n\nChange: ${text}`.trim();
    const nextPlan: Plan = { ...plan, summary: plan.summary.includes(text) ? plan.summary : `${plan.summary} (Note: ${text})` };
    setBrief(nextBrief);
    setPlan(nextPlan);
    setChange("");
    persist(nextPlan, nextBrief);
    toast.success("Added to the brief", "The builder will follow this when it makes the draft.");
  };

  const approve = async () => {
    if (!plan) return;
    setApproving(true);
    try {
      const view = await api<ProjectView>(`/api/projects/${project.id}/build`, { method: "POST", json: { plan, brief } });
      syncProject(view);
    } catch (e) {
      toast.error("Couldn't start the build", e instanceof Error ? e.message : undefined);
    } finally {
      setApproving(false);
    }
  };

  const replan = async () => {
    try {
      const view = await api<ProjectView>(`/api/projects/${project.id}/plan`, { method: "POST", json: { brief } });
      syncProject(view);
    } catch (e) {
      toast.error("Couldn't re-plan", e instanceof Error ? e.message : undefined);
    }
  };

  const failed = project.status === "FAILED";
  const failedJob = project.jobs.find((j) => j.status === "FAILED");

  return (
    <div className="h-full overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-8">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Step 2 of 3</div>
          <h1 className="mt-1 font-display text-3xl">Here is how I would cut it</h1>
          <p className="mt-1 text-sm text-muted">Turn any line off, double-click to rewrite it, or tell me what to change. Approve when it reads right.</p>
        </div>
        {failed && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">The last build failed</div>
              <div className="text-xs opacity-80">{failedJob?.error ?? project.statusMessage ?? "Try approving again or ask for a new plan."}</div>
            </div>
          </div>
        )}
        {plan ? <PlanCard plan={plan} onChange={onChange} /> : <div className="rounded-xl border border-border p-6 text-sm text-muted">No plan yet.</div>}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-2 p-2 pl-3">
          <MessageSquarePlus className="h-4 w-4 shrink-0 text-muted" />
          <Input
            value={change}
            onChange={(e) => setChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addChange()}
            placeholder="Change something… e.g. “no music”, “make it moodier”, “keep it under 30 seconds”"
            className="h-8 border-0 bg-transparent px-1 focus:ring-0"
          />
          <Button size="sm" variant="secondary" onClick={addChange} disabled={!change.trim()}>
            Add
          </Button>
        </div>
        {brief && (
          <details className="rounded-xl border border-border bg-bg-2 px-4 py-3 text-xs text-muted">
            <summary className="cursor-pointer select-none font-medium text-fg">Your brief</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed">{brief}</pre>
          </details>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button variant="ghost" size="sm" onClick={replan}>
            <RotateCcw className="h-3.5 w-3.5" /> Ask for a different plan
          </Button>
          <Button variant="accent" size="lg" onClick={approve} disabled={!plan || approving} className="min-w-[180px]">
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Approve & build <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
