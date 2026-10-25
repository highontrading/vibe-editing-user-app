/** cleanup: scratch dirs older than a day, finished Job rows older than 30 days. */
import fsp from "node:fs/promises";
import path from "node:path";
import { prisma } from "@vibe/db";
import { tmpRoot } from "../util";
import type { JobContext } from "./common";

const DAY = 24 * 3600 * 1000;

export async function cleanupJob(ctx: JobContext) {
  await ctx.progress(10, "Cleaning scratch files…", true);
  const root = tmpRoot();
  let dirsRemoved = 0;
  const cutoff = Date.now() - DAY;
  const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const p = path.join(root, e.name);
    const st = await fsp.stat(p).catch(() => null);
    if (!st || st.mtimeMs > cutoff) continue;
    await fsp.rm(p, { recursive: true, force: true }).catch(() => {});
    dirsRemoved++;
  }
  await ctx.progress(60, "Tidying old job records…", true);
  const jobs = await prisma.job.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 30 * DAY) }, status: { in: ["DONE", "FAILED", "CANCELLED"] }, id: { not: ctx.jobId } },
  });
  return { dirsRemoved, jobsDeleted: jobs.count };
}
