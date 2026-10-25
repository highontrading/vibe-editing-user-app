import type { JobRunner } from "@vibe/core";
export const runJob: JobRunner = async (job) => {
  throw new Error(`not implemented: ${job.type}`);
};
