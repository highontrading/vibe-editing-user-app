/**
 * runJob: executes one job and keeps the Job row (status/progress/message/
 * error/result) in sync so the UI can poll it. Handlers update the related
 * rows (Asset, Project, ScriptVersion, Message, Export, User minutes).
 */
import { updateJob, type JobRunner, type JobType } from "@vibe/core";
import { prisma } from "@vibe/db";
import { errorMessage, log, progressReporter } from "./util";
import type { JobHandler } from "./jobs/common";
import { ingestJob } from "./jobs/ingest";
import { analyzeJob } from "./jobs/analyze";
import { planJob } from "./jobs/plan";
import { buildJob } from "./jobs/build";
import { editJob } from "./jobs/edit";
import { renderJob } from "./jobs/render";
import { thumbnailJob } from "./jobs/thumbnail";
import { generateJob } from "./jobs/generate";
import { cleanupJob } from "./jobs/cleanup";

const handlers: Record<JobType, JobHandler> = {
  ingest: ingestJob,
  analyze: analyzeJob,
  plan: planJob,
  build: buildJob,
  edit: editJob,
  render: renderJob,
  thumbnail: thumbnailJob,
  generate: generateJob,
  cleanup: cleanupJob,
};

const STARTING: Record<JobType, string> = {
  ingest: "Preparing your upload…",
  analyze: "Understanding your footage…",
  plan: "Planning your edit…",
  build: "Building your draft…",
  edit: "Working on your change…",
  render: "Starting the export…",
  thumbnail: "Making a thumbnail…",
  generate: "Generating media…",
  cleanup: "Cleaning up…",
};

export const runJob: JobRunner = async (job) => {
  const handler = handlers[job.type];
  if (!handler) throw new Error(`Unknown job type: ${job.type}`);
  const payload = (job.payload ?? {}) as Record<string, unknown>;

  const row = await prisma.job.findUnique({ where: { id: job.id } });
  if (!row) {
    // Allow running jobs that were not created through enqueue() (tests, scripts).
    await prisma.job.create({
      data: {
        id: job.id,
        type: job.type,
        payload: payload as object,
        status: "QUEUED",
        projectId: typeof payload.projectId === "string" ? payload.projectId : undefined,
        assetId: typeof payload.assetId === "string" ? payload.assetId : undefined,
      },
    });
  } else if (row.status === "CANCELLED") {
    log(job.type, `job ${job.id} was cancelled; skipping`);
    return;
  }

  await prisma.job.update({
    where: { id: job.id },
    data: { status: "RUNNING", startedAt: new Date(), finishedAt: null, progress: 0, error: null, message: STARTING[job.type], attempts: { increment: 1 } },
  });
  const started = Date.now();
  log(job.type, `start ${job.id}`, JSON.stringify(payload));
  try {
    const result = await handler({ jobId: job.id, type: job.type, payload, progress: progressReporter(job.id) });
    await updateJob(job.id, { status: "DONE", progress: 100, message: "Done", result: result ?? null });
    log(job.type, `done ${job.id} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (e) {
    const error = errorMessage(e);
    log(job.type, `FAILED ${job.id}: ${error}`);
    await updateJob(job.id, { status: "FAILED", error: error.slice(0, 2000), message: "Failed" }).catch(() => {});
    throw e;
  }
};
