/** Public API implementation. Keep signatures: the pipeline and web app depend on them. */
import { env } from "@vibe/core";
import type { AssetAnalysis, EditScript } from "@vibe/edl";
import type { BuildResult, ChatTurn, EditResult, MediaProvider, PlanResult, ProjectContext } from "./types";
import { createPlan as createPlanImpl } from "./plan";
import { buildScript as buildScriptImpl } from "./build";
import { editScript as editScriptImpl } from "./edit";
import { selfCheckSync } from "./check";
import { describeFrames as describeFramesImpl, type FrameDescription, type FrameInput } from "./vision";
import { pickHooks as pickHooksImpl } from "./hooks";
import { quickSuggestions as quickSuggestionsImpl } from "./suggestions";

export function isMockMode(): boolean {
  return env.mockAi;
}

export async function createPlan(ctx: ProjectContext): Promise<PlanResult> {
  return createPlanImpl(ctx);
}

export async function buildScript(ctx: ProjectContext, plan: PlanResult["plan"], media: MediaProvider): Promise<BuildResult> {
  return buildScriptImpl(ctx, plan, media);
}

export async function editScript(ctx: ProjectContext, script: EditScript, instruction: string, history: ChatTurn[], media: MediaProvider): Promise<EditResult> {
  return editScriptImpl(ctx, script, instruction, history ?? [], media);
}

export async function selfCheck(script: EditScript, ctx?: Pick<ProjectContext, "platform" | "targetDurationMs">) {
  const r = selfCheckSync(script, ctx ?? null);
  return { checks: r.checks, script: r.script, ops: r.ops, fixed: r.fixed };
}

export async function describeFrames(frames: FrameInput[]): Promise<FrameDescription[]> {
  return describeFramesImpl(frames);
}

export function pickHooks(analysis: AssetAnalysis) {
  return pickHooksImpl(analysis);
}

export function quickSuggestions(script: EditScript): string[] {
  return quickSuggestionsImpl(script);
}
