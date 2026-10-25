import { enqueue, type JobType } from "@vibe/core";
import { prisma } from "@vibe/db";
import { log, type ProgressFn } from "../util";

export interface JobContext<T extends JobType = JobType> {
  jobId: string;
  type: T;
  payload: Record<string, unknown>;
  /** progress(0-100, message a user understands) */
  progress: ProgressFn;
}

export type JobHandler = (ctx: JobContext) => Promise<unknown>;

export function requireString(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  if (typeof v !== "string" || !v) throw new Error(`Job payload is missing "${key}"`);
  return v;
}

/**
 * When every asset of a project is done processing and the project is still
 * ANALYZING, move it to PLANNING (atomically, so two analyze jobs finishing at
 * once enqueue exactly one plan) and enqueue the plan job.
 */
export async function maybeEnqueuePlan(projectId: string | null | undefined): Promise<boolean> {
  if (!projectId) return false;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { assets: { where: { source: { not: "RENDER" } }, select: { id: true, status: true } } },
  });
  if (!project || project.status !== "ANALYZING") return false;
  const pending = project.assets.filter((a) => a.status !== "READY" && a.status !== "FAILED");
  if (pending.length) return false;
  if (!project.assets.some((a) => a.status === "READY")) return false;
  const r = await prisma.project.updateMany({ where: { id: projectId, status: "ANALYZING" }, data: { status: "PLANNING", statusMessage: "Planning your edit…" } });
  if (r.count !== 1) return false;
  await enqueue("plan", { projectId }, { userId: project.userId, projectId });
  log("plan", `all assets ready for project ${projectId}; plan enqueued`);
  return true;
}
