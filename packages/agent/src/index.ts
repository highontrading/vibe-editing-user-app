/**
 * PUBLIC API (stable; the pipeline and web app depend on it):
 *   createPlan(ctx)                       -> PlanResult      brief + footage -> plain-words plan
 *   buildScript(ctx, plan, media)         -> BuildResult     plan -> EditScript (uses tools/ops)
 *   editScript(ctx, script, instruction, history, media) -> EditResult   chat edits
 *   selfCheck(script, ctx)                -> { checks, script }   deterministic fixes
 *   describeFrames(frames)                -> string[]        vision descriptions (Haiku) for analysis
 *   pickHooks(analysis)                   -> hooks           best opening lines
 *   quickSuggestions(script)              -> string[]        chips under the chat
 *   isMockMode()                          -> boolean
 */
export * from "./types";
export { createPlan, buildScript, editScript, selfCheck, describeFrames, pickHooks, quickSuggestions, isMockMode } from "./agent";

// Additional exports (deterministic engine pieces other packages may reuse).
export { buildFromPlan, applyPlanTweaks, resolveParams, summarizeBuild, trimScriptToTarget, normalizeEnds, OpRecorder, type BuildParams, type BuildStats, type BuildOutput } from "./builder";
export { buildManifest, MANIFEST_TOKEN_BUDGET } from "./manifest";
export { mockPlan, parseBrief, PlanOutputSchema } from "./plan";
export { mockEdit } from "./edit";
export { describeScriptState, findPhrase } from "./tools";
export { scoreHookText } from "./hooks";
export type { FrameInput, FrameDescription } from "./vision";
export { EDITOR_PLAYBOOK } from "./prompts";
