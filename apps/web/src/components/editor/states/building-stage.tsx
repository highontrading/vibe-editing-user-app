"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useEditor } from "@/lib/editor/store";
import { PlanCard } from "./plan-card";

/** BUILDING: the draft is being assembled; stream the job message. */
export function BuildingStage() {
  const project = useEditor((s) => s.project);
  if (!project) return null;
  const job = project.jobs.find((j) => j.type === "build" && (j.status === "RUNNING" || j.status === "QUEUED")) ?? project.jobs.find((j) => j.type === "build");
  const done = project.jobs.filter((j) => j.status === "DONE").slice(0, 6);
  const progress = job?.progress ?? 0;
  return (
    <div className="h-full overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-6 py-8">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Step 3 of 3</div>
          <h1 className="mt-1 font-display text-3xl">Building your draft…</h1>
          <p className="mt-1 text-sm text-muted">Cutting, captioning and mixing. This usually takes a minute or two; you can leave this page and come back.</p>
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-accent/15">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{job?.message ?? project.statusMessage ?? "Starting…"}</div>
              <div className="text-xs text-muted">{job?.status === "QUEUED" ? "Waiting for a worker" : `${progress}%`}</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
            <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${Math.max(3, progress)}%` }} transition={{ ease: "easeOut", duration: 0.5 }} />
          </div>
          {done.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {done.map((j) => (
                <li key={j.id} className="flex items-center gap-2 text-xs text-muted">
                  <Check className="h-3 w-3 text-success" /> {j.message ?? `${j.type} done`}
                </li>
              ))}
            </ul>
          )}
        </div>
        {project.plan && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Following the approved plan
            </div>
            <PlanCard plan={project.plan} compact />
          </div>
        )}
      </motion.div>
    </div>
  );
}
