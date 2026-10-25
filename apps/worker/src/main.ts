/**
 * Worker: consumes the BullMQ queues and runs pipeline jobs.
 * Requires REDIS_URL. (Without Redis the web app runs jobs inline instead.)
 */
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env, JOB_QUEUE, RENDER_QUEUE } from "@vibe/core";
import { runJob } from "@vibe/pipeline";
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

// Health endpoint for Railway.
const port = Number(process.env.PORT || 8080);
http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, queues: [JOB_QUEUE, RENDER_QUEUE] }));
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
