/**
 * buildScript: plan → EditScript.
 * builder (deterministic) → selfCheck fixes → (Claude mode only) one director review pass with the ops tools.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { env } from "@vibe/core";
import type { Plan } from "@vibe/edl";
import type { BuildResult, MediaProvider, ProjectContext } from "./types";
import { buildFromPlan, summarizeBuild, type BuildStats } from "./builder";
import { selfCheckSync } from "./check";
import { quickSuggestions } from "./suggestions";
import { BETAS, FALLBACKS, getClient, stopIssue, systemBlocks, warn } from "./client";
import { buildManifest } from "./manifest";
import { EditSession, describeScriptState, makeTools } from "./tools";
import { stableJson } from "./prompts";

export async function buildScript(ctx: ProjectContext, plan: Plan, media: MediaProvider): Promise<BuildResult> {
  const built = await buildFromPlan(ctx, plan, media);
  const target = plan.targetDurationMs ?? ctx.targetDurationMs ?? undefined;
  let check = selfCheckSync(built.script, { platform: built.params.platform, targetDurationMs: target });
  let script = check.script;
  let summary = summarizeBuild({ ...built.stats, durationMs: script.output.durationMs });
  let suggestions = quickSuggestions(script);
  if (check.fixed.length) summary += ` Self-check: ${check.fixed.join(", ")}.`;

  if (!env.mockAi) {
    try {
      const review = await directorReview(ctx, plan, script, built.stats, check.checks.map((c) => `${c.ok ? "ok" : "FAIL"} ${c.label}${c.detail ? ` (${c.detail})` : ""}`), media);
      if (review) {
        if (review.ops.length) {
          check = selfCheckSync(review.script, { platform: built.params.platform, targetDurationMs: target });
          script = check.script;
        }
        if (review.summary) summary = review.summary;
        if (review.suggestions?.length) suggestions = review.suggestions;
      }
    } catch (e) {
      warn("review", e);
    }
  }
  return { script, summary, checks: check.checks, suggestions };
}

async function directorReview(ctx: ProjectContext, plan: Plan, script: BuildResult["script"], stats: BuildStats, checks: string[], media: MediaProvider) {
  const client = getClient();
  const session = new EditSession(ctx, script, media);
  const tools = makeTools(session);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: [{ type: "text", text: `FOOTAGE MANIFEST (source times, for reference):\n${buildManifest(ctx, { budgetTokens: 12_000 })}`, cache_control: { type: "ephemeral" } }] },
    { role: "assistant", content: "Got it. I have the footage manifest. I will apply each instruction with the tools, verify the result, and call finish." },
    {
      role: "user",
      content: [
        { type: "text", text: `APPROVED PLAN:\n${stableJson(plan)}` },
        { type: "text", text: `BUILDER STATS:\n${stableJson(stats)}\n\nSELF-CHECK:\n${checks.join("\n")}` },
        { type: "text", text: `DRAFT SCRIPT STATE:\n${describeScriptState(script)}` },
        { type: "text", text: "Review the draft as the director. Make only targeted refinements (at most about eight tool calls), then call finish with the summary, message and suggestions." },
      ],
    },
  ];
  const runner = client.beta.messages.toolRunner({
    model: env.agentModel,
    max_tokens: 16_000,
    max_iterations: 8,
    betas: BETAS,
    fallbacks: FALLBACKS,
    output_config: { effort: "medium" },
    system: systemBlocks(ctx, "review"),
    tools,
    messages,
  });
  for await (const message of runner) {
    const issue = stopIssue(message);
    if (issue) {
      warn("review", issue);
      break;
    }
    await runner.generateToolResponse();
    if (session.finish) break;
  }
  return { script: session.script, ops: session.ops, summary: session.finish?.summary, suggestions: session.finish?.suggestions };
}
