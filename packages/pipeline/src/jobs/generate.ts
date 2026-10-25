/** generate {projectId, kind, params}: media provider call -> Asset row in the project; result {assetId}. */
import { prisma } from "@vibe/db";
import type { AssetRef } from "@vibe/edl";
import { media } from "../media-provider";
import { requireString, type JobContext } from "./common";

export async function generateJob(ctx: JobContext) {
  const projectId = requireString(ctx.payload, "projectId");
  const kind = requireString(ctx.payload, "kind");
  const params = (ctx.payload.params ?? {}) as Record<string, unknown>;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project ${projectId} not found`);
  const str = (k: string, fallback?: string) => (typeof params[k] === "string" && params[k] ? (params[k] as string) : fallback);
  const num = (k: string, fallback: number) => (typeof params[k] === "number" ? (params[k] as number) : fallback);

  let ref: AssetRef;
  switch (kind) {
    case "music":
      await ctx.progress(10, "Composing music…", true);
      ref = await media.getMusic({ mood: str("mood", "lofi")!, durationMs: num("durationMs", 30000), projectId });
      break;
    case "sfx":
      await ctx.progress(10, "Making the sound effect…", true);
      ref = await media.getSfx({ sfxId: str("sfxId", "sfx-whoosh-1")!, projectId });
      break;
    case "voice": {
      if (!media.generateVoice) throw new Error("Voice generation needs ELEVENLABS_API_KEY.");
      const text = str("text");
      if (!text) throw new Error("Voice generation needs params.text");
      await ctx.progress(10, "Recording the voice-over…", true);
      ref = await media.generateVoice({ text, voice: str("voice"), projectId });
      break;
    }
    case "image": {
      if (!media.generateImage) throw new Error("Image generation is not configured (see media-provider.ts for how to add fal.ai).");
      await ctx.progress(10, "Generating the image…", true);
      ref = await media.generateImage({ prompt: str("prompt", "")!, aspect: str("aspect", project.aspect)!, projectId });
      break;
    }
    case "video": {
      const query = str("query", str("prompt", "b-roll"))!;
      const orientation = (str("orientation") as "portrait" | "landscape" | "square" | undefined) ?? (project.aspect === "16:9" ? "landscape" : project.aspect === "1:1" ? "square" : "portrait");
      await ctx.progress(10, "Finding b-roll…", true);
      const results = await media.searchStock({ query, kind: "video", orientation, projectId, limit: num("limit", 1) });
      if (!results.length) throw new Error(`No stock video found for "${query}"`);
      ref = results[0]!;
      break;
    }
    default:
      throw new Error(`Unknown generate kind "${kind}"`);
  }
  return { assetId: ref.id, url: ref.url, kind: ref.kind, durationMs: ref.durationMs, name: ref.name, source: ref.source };
}
