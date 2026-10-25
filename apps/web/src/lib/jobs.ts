/**
 * Ensures the inline job runner is registered when no Redis is configured.
 * Imported by route handlers that enqueue jobs and by instrumentation.ts.
 *
 * The pipeline package pulls in @vibe/compositions (React/JSX Remotion
 * components) and the Remotion renderer toolchain, none of which can be bundled
 * into Next's server runtime. So instead of letting webpack bundle it, the
 * pipeline is loaded with Node's own module loader (tsx hooks make the
 * workspace TypeScript sources importable), exactly like the worker does.
 * `webpackIgnore` keeps webpack from touching these dynamic imports.
 */
import { env, registerInlineRunner } from "@vibe/core";

type Loaded = { runJob: import("@vibe/core").JobRunner };
const g = globalThis as unknown as { __vibeJobRunner?: Promise<Loaded | null> };

async function loadPipeline(): Promise<Loaded | null> {
  try {
    const tsx = (await import(/* webpackIgnore: true */ "tsx/esm/api")) as { register: (o?: unknown) => unknown };
    tsx.register();
    const pipeline = (await import(/* webpackIgnore: true */ "@vibe/pipeline")) as typeof import("@vibe/pipeline");
    // The natively loaded pipeline has its own copy of @vibe/core; jobs it enqueues (ingest -> analyze -> plan)
    // must find a runner there too.
    const nativeCore = (await import(/* webpackIgnore: true */ "@vibe/core")) as typeof import("@vibe/core");
    nativeCore.registerInlineRunner(pipeline.runJob);
    return { runJob: pipeline.runJob };
  } catch (e) {
    console.error("[jobs] could not load @vibe/pipeline for inline jobs:", e);
    return null;
  }
}

export async function ensureJobRunner() {
  if (env.redisUrl) return;
  if (!g.__vibeJobRunner) g.__vibeJobRunner = loadPipeline();
  const loaded = await g.__vibeJobRunner;
  if (loaded) registerInlineRunner(loaded.runJob);
  else
    registerInlineRunner(async (job) => {
      throw new Error(`Inline job runner unavailable (pipeline failed to load): ${job.type}`);
    });
}
