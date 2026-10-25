/**
 * Job dispatch. With REDIS_URL set we use BullMQ (the worker app consumes it).
 * Without it, jobs run inline in the calling process via a registered runner
 * (the web app registers @vibe/pipeline's runJob at startup).
 */
import { prisma, type Job as JobRow } from "@vibe/db";
import { env } from "./env";

export const JOB_QUEUE = "vibe-jobs";
export const RENDER_QUEUE = "vibe-render";

export type JobType = "ingest" | "analyze" | "plan" | "build" | "edit" | "render" | "thumbnail" | "generate" | "cleanup";

export interface JobPayloads {
  ingest: { assetId: string };
  analyze: { assetId: string };
  plan: { projectId: string };
  build: { projectId: string };
  edit: { projectId: string; messageId: string };
  render: { exportId: string };
  thumbnail: { projectId: string };
  generate: { projectId: string; kind: "music" | "sfx" | "voice" | "image" | "video"; params: Record<string, unknown> };
  cleanup: Record<string, never>;
}

export type JobRunner = (job: { id: string; type: JobType; payload: Record<string, unknown> }) => Promise<void>;

let inlineRunner: JobRunner | null = null;
export function registerInlineRunner(runner: JobRunner) {
  inlineRunner = runner;
}

const RENDER_TYPES: JobType[] = ["render"];

type BullQueue = import("bullmq").Queue;
let queues: { jobs: BullQueue; render: BullQueue } | null = null;
async function getQueues() {
  if (queues) return queues;
  const { Queue } = await import("bullmq");
  const { default: IORedis } = await import("ioredis");
  const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  queues = {
    jobs: new Queue(JOB_QUEUE, { connection, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 500, removeOnFail: 500 } }),
    render: new Queue(RENDER_QUEUE, { connection, defaultJobOptions: { attempts: 2, backoff: { type: "exponential", delay: 10000 }, removeOnComplete: 200, removeOnFail: 200 } }),
  };
  return queues;
}

export async function enqueue<T extends JobType>(type: T, payload: JobPayloads[T], meta: { userId?: string; projectId?: string; assetId?: string } = {}): Promise<JobRow> {
  const row = await prisma.job.create({
    data: { type, payload: payload as object, userId: meta.userId, projectId: meta.projectId, assetId: meta.assetId, status: "QUEUED" },
  });
  if (env.redisUrl) {
    const q = await getQueues();
    const target = RENDER_TYPES.includes(type) ? q.render : q.jobs;
    await target.add(type, { id: row.id, type, payload }, { jobId: row.id });
  } else {
    if (!inlineRunner) throw new Error("No REDIS_URL and no inline job runner registered");
    const runner = inlineRunner;
    // Fire and forget; the runner updates the Job row.
    setTimeout(() => {
      runner({ id: row.id, type, payload: payload as Record<string, unknown> }).catch((e) => {
        console.error(`[inline job ${type}:${row.id}] failed`, e);
      });
    }, 0);
  }
  return row;
}

export async function updateJob(id: string, patch: { status?: JobRow["status"]; progress?: number; message?: string; error?: string; result?: unknown }) {
  const data: Record<string, unknown> = {};
  if (patch.status) {
    data.status = patch.status;
    if (patch.status === "RUNNING") data.startedAt = new Date();
    if (patch.status === "DONE" || patch.status === "FAILED") data.finishedAt = new Date();
  }
  if (patch.progress !== undefined) data.progress = Math.max(0, Math.min(100, Math.round(patch.progress)));
  if (patch.message !== undefined) data.message = patch.message;
  if (patch.error !== undefined) data.error = patch.error;
  if (patch.result !== undefined) data.result = patch.result as object;
  return prisma.job.update({ where: { id }, data });
}
