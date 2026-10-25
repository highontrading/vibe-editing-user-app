import { z } from "zod";
import { applyOps, MUSIC_MOODS, getTrack, type EditOp } from "@vibe/edl";
import { route, json, parseBody, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { createVersion, currentScript, getOwnedProject, toVersionView } from "@/lib/editor/project-service";
import { resolveScriptUrls } from "@/lib/editor/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ mood: z.enum(MUSIC_MOODS).nullable(), gainDb: z.number().optional(), ducking: z.boolean().optional() });

/**
 * POST /api/projects/[id]/music {mood | null} -> {ops, version, script}
 * Picks a track for the mood via @vibe/pipeline media.getMusic and swaps the music bed.
 */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const body = await parseBody(req, Body);
  const { version: base, script } = await currentScript(project);
  const music = getTrack(script, "audio", (t) => t.role === "music");
  const ops: EditOp[] = [];
  for (const c of music?.clips ?? []) ops.push({ op: "deleteAudioClip", clipId: c.id });
  let label = "Music removed";
  if (body.mood) {
    const { media } = await import("@vibe/pipeline");
    const ref = await media.getMusic({ mood: body.mood, durationMs: script.output.durationMs, projectId: id });
    ops.push({ op: "registerAsset", asset: ref });
    ops.push({
      op: "addAudioClip",
      role: "music",
      clip: {
        assetId: ref.id,
        startMs: 0,
        inMs: 0,
        gainDb: body.gainDb ?? -18,
        ducking: body.ducking ?? true,
        loop: true,
        fadeInMs: 500,
        fadeOutMs: 1500,
        label: `${body.mood} · ${ref.name ?? "music"}`,
        reason: `Music chosen for mood “${body.mood}”`,
      },
    });
    label = `Music: ${body.mood}`;
  }
  if (ops.length === 0) return json(serialize({ ops, version: toVersionView(base), script: await resolveScriptUrls(script) }));
  const next = applyOps(script, ops);
  const version = await createVersion(project, next, { source: "USER", label, parentId: base.id });
  return json(serialize({ ops, version: toVersionView(version), script: await resolveScriptUrls(next) }));
});
