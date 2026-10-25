/** Frame descriptions with Haiku vision (batches of 8), structured output. MOCK: placeholder shots. */
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { env } from "@vibe/core";
import { BETAS, FALLBACKS, getClient, stopIssue, warn } from "./client";
import { VISION_INSTRUCTIONS } from "./prompts";

export interface FrameInput {
  timeMs: number;
  jpegBase64: string;
}
export interface FrameDescription {
  timeMs: number;
  description: string;
  subjectX: number;
  subjectY: number;
  tags: string[];
}

const FrameSchema = z.object({
  timeMs: z.number(),
  description: z.string(),
  subjectX: z.number(),
  subjectY: z.number(),
  tags: z.array(z.string()),
});
const FramesOutputSchema = z.object({ frames: z.array(FrameSchema) });

const BATCH = 8;

export function mockDescriptions(frames: FrameInput[]): FrameDescription[] {
  return frames.map((f, i) => ({ timeMs: f.timeMs, description: `Shot ${i + 1}: footage frame`, subjectX: 0.5, subjectY: 0.5, tags: [] }));
}

export async function describeFrames(frames: FrameInput[]): Promise<FrameDescription[]> {
  if (!frames.length) return [];
  if (env.mockAi) return mockDescriptions(frames);
  const batches: FrameInput[][] = [];
  for (let i = 0; i < frames.length; i += BATCH) batches.push(frames.slice(i, i + BATCH));
  const out: FrameDescription[] = [];
  // Modest concurrency: image batches share no cacheable prefix, so parallelism only trades latency for rate limit.
  const concurrency = 3;
  for (let i = 0; i < batches.length; i += concurrency) {
    const results = await Promise.all(batches.slice(i, i + concurrency).map((b) => describeBatch(b)));
    for (const r of results) out.push(...r);
  }
  return out;
}

async function describeBatch(batch: FrameInput[]): Promise<FrameDescription[]> {
  const client = getClient();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  batch.forEach((f, i) => {
    content.push({ type: "text", text: `Frame ${i + 1}: timeMs=${f.timeMs}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.jpegBase64 } });
  });
  content.push({ type: "text", text: `Describe these ${batch.length} frames. Return one entry per frame with the timeMs given in its label.` });
  try {
    const response = await client.beta.messages.parse({
      model: env.agentFastModel,
      max_tokens: 4000,
      betas: BETAS,
      fallbacks: FALLBACKS,
      system: VISION_INSTRUCTIONS,
      output_config: { effort: "low", format: betaZodOutputFormat(FramesOutputSchema) },
      messages: [{ role: "user", content }],
    });
    const issue = stopIssue(response);
    const parsed = response.parsed_output;
    if (issue || !parsed) {
      warn("vision", issue ?? "no structured output");
      return mockDescriptions(batch);
    }
    // Align by order; fall back to label time when the model drifted.
    return batch.map((f, i) => {
      const d = parsed.frames[i] ?? parsed.frames.find((x) => x.timeMs === f.timeMs);
      if (!d) return mockDescriptions([f])[0]!;
      return {
        timeMs: f.timeMs,
        description: d.description.trim() || `Shot ${i + 1}: footage frame`,
        subjectX: clamp01(d.subjectX),
        subjectY: clamp01(d.subjectY),
        tags: d.tags.map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 6),
      };
    });
  } catch (e) {
    warn("vision", e);
    return mockDescriptions(batch);
  }
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
}
