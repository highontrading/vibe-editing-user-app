/**
 * Anthropic client plumbing shared by plan/build/edit/vision.
 * Only used when an ANTHROPIC_API_KEY is present (env.mockAi === false).
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@vibe/core";
import type { ProjectContext } from "./types";
import { corePromptBlock, projectPromptBlock } from "./prompts";

let client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicKey });
  return client;
}

/** Refusal fallback: on a policy decline the API re-runs on the default fallback model inside the same call. */
export const BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];
export const FALLBACKS = "default" as const;

/**
 * System blocks: [core playbook + catalogue (shared by everyone), project block (recipe/brand/preferences)].
 * Both are marked as cache breakpoints; everything volatile goes into messages after them.
 */
export function systemBlocks(ctx: ProjectContext, task: "plan" | "edit" | "review"): Anthropic.Beta.BetaTextBlockParam[] {
  return [
    { type: "text", text: corePromptBlock(task), cache_control: { type: "ephemeral" } },
    { type: "text", text: projectPromptBlock(ctx), cache_control: { type: "ephemeral" } },
  ];
}

export function textOf(message: { content: Array<{ type: string; text?: string }> } | undefined | null): string {
  if (!message) return "";
  return message.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}

/** Human-readable problem for a stop reason we cannot continue from, or null when fine. */
export function stopIssue(message: { stop_reason: string | null; stop_details?: { explanation?: string | null } | null } | undefined | null): string | null {
  if (!message) return null;
  if (message.stop_reason === "refusal") return `Claude declined this request${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : ""}.`;
  if (message.stop_reason === "max_tokens") return "Claude ran out of room before finishing.";
  if (message.stop_reason === "model_context_window_exceeded") return "The project is too large for one request.";
  return null;
}

export function isApiError(e: unknown): boolean {
  return e instanceof Anthropic.APIError;
}

export function warn(scope: string, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.warn(`[agent:${scope}] ${msg}`);
}
