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

type PipelineModule = typeof import("@vibe/pipeline");
const g = globalThis as unknown as { __vibePipeline?: Promise<PipelineModule> };

/**
 * Loads @vibe/pipeline outside the webpack bundle. Use this from any route
 * handler that needs the pipeline (`const { media } = await loadPipeline()`);
 * a static `import ... from "@vibe/pipeline"` in server code breaks `next build`.
 */
export function loadPipeline(): Promise<PipelineModule> {
  if (!g.__vibePipeline) {
    g.__vibePipeline = (async () => {
      const tsx = (await import(/* webpackIgnore: true */ "tsx/esm/api")) as { register: (o?: unknown) => unknown };
      tsx.register();
      const pipeline = (await import(/* webpackIgnore: true */ "@vibe/pipeline")) as PipelineModule;
      // The natively loaded pipeline has its own copy of @vibe/core; jobs it enqueues (ingest -> analyze -> plan)
      // must find an inline runner there too.
      if (!env.redisUrl) {
        const nativeCore = (await import(/* webpackIgnore: true */ "@vibe/core")) as typeof import("@vibe/core");
        nativeCore.registerInlineRunner(pipeline.runJob);
      }
      return pipeline;
    })();
    g.__vibePipeline.catch((e) => {
      console.error("[jobs] could not load @vibe/pipeline:", e);
      g.__vibePipeline = undefined;
    });
  }
  return g.__vibePipeline;
}

export async function ensureJobRunner() {
  if (env.redisUrl) return;
  try {
    const { runJob } = await loadPipeline();
    registerInlineRunner(runJob);
  } catch (e) {
    registerInlineRunner(async (job) => {
      throw new Error(`Inline job runner unavailable (pipeline failed to load: ${e instanceof Error ? e.message : e}): ${job.type}`);
    });
  }
}
