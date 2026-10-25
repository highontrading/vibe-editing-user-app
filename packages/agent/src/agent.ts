/** STUB implementations; replaced by the real agent. Keep signatures. */
import { env } from "@vibe/core";
import { runChecks, type AssetAnalysis, type EditScript } from "@vibe/edl";
import type { BuildResult, ChatTurn, EditResult, MediaProvider, PlanResult, ProjectContext } from "./types.js";

export function isMockMode() {
  return env.mockAi;
}

export async function createPlan(_ctx: ProjectContext): Promise<PlanResult> {
  throw new Error("not implemented");
}
export async function buildScript(_ctx: ProjectContext, _plan: PlanResult["plan"], _media: MediaProvider): Promise<BuildResult> {
  throw new Error("not implemented");
}
export async function editScript(_ctx: ProjectContext, _script: EditScript, _instruction: string, _history: ChatTurn[], _media: MediaProvider): Promise<EditResult> {
  throw new Error("not implemented");
}
export async function selfCheck(script: EditScript, ctx?: Pick<ProjectContext, "platform" | "targetDurationMs">) {
  return { checks: runChecks(script, { platform: ctx?.platform as never, targetDurationMs: ctx?.targetDurationMs ?? undefined }), script };
}
export async function describeFrames(_frames: { timeMs: number; jpegBase64: string }[]): Promise<{ timeMs: number; description: string; subjectX: number; subjectY: number; tags: string[] }[]> {
  throw new Error("not implemented");
}
export function pickHooks(_analysis: AssetAnalysis) {
  return [] as AssetAnalysis["hooks"];
}
export function quickSuggestions(_script: EditScript): string[] {
  return [];
}
