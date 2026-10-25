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
export * from "./types.js";
export { createPlan, buildScript, editScript, selfCheck, describeFrames, pickHooks, quickSuggestions, isMockMode } from "./agent.js";
