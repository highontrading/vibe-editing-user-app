/**
 * Ensures the inline job runner is registered when no Redis is configured.
 * Imported by route handlers that enqueue jobs and by instrumentation.ts.
 */
import { env, registerInlineRunner } from "@vibe/core";

let registered = false;
export async function ensureJobRunner() {
  if (registered || env.redisUrl) return;
  const { runJob } = await import("@vibe/pipeline");
  registerInlineRunner(runJob);
  registered = true;
}
