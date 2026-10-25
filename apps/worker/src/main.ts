/**
 * Worker: consumes the BullMQ queues and runs pipeline jobs.
 * Requires REDIS_URL. (Without Redis the web app runs jobs inline instead.)
 */
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env, enqueue, JOB_QUEUE, RENDER_QUEUE } from "@vibe/core";
import { runJob, warmRenderer } from "@vibe/pipeline";
import http from "node:http";

if (!env.redisUrl) {
  console.error("REDIS_URL is required for the worker");
  process.exit(1);
}

const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

const jobs = new Worker(JOB_QUEUE, async (job) => runJob(job.data), { connection, concurrency: env.workerConcurrency });
const render = new Worker(RENDER_QUEUE, async (job) => runJob(job.data), { connection, concurrency: env.renderConcurrency });

for (const w of [jobs, render]) {
  w.on("completed", (job) => console.log(`[worker] ${job.name} ${job.id} done`));
  w.on("failed", (job, err) => console.error(`[worker] ${job?.name} ${job?.id} failed:`, err.message));
}

// Pre-bundle the Remotion compositions and locate a browser so the first export is fast.
let rendererReady: { bundled: boolean; browser: boolean } | null = null;
warmRenderer()
  .then((r) => {
    rendererReady = r;
    console.log(`[worker] renderer warm: bundle=${r.bundled} browser=${r.browser}`);
  })
  .catch((e) => console.error("[worker] renderer warm-up failed:", e));

// Scheduled cleanup (scratch dirs > 1 day, finished jobs > 30 days). Set CLEANUP_INTERVAL_HOURS=0 to disable.
const cleanupHours = Number(process.env.CLEANUP_INTERVAL_HOURS ?? "24");
if (cleanupHours > 0) {
  const tick = () => enqueue("cleanup", {}).catch((e) => console.error("[worker] cleanup enqueue failed:", e));
  setTimeout(tick, 60_000).unref();
  setInterval(tick, cleanupHours * 3600_000).unref();
}

// Health endpoint for Railway.
const port = Number(process.env.PORT || 8080);
http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, queues: [JOB_QUEUE, RENDER_QUEUE], renderer: rendererReady }));
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(port, () => console.log(`[worker] health on :${port}`));

async function shutdown() {
  console.log("[worker] shutting down");
  await Promise.all([jobs.close(), render.close()]);
  await connection.quit();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
