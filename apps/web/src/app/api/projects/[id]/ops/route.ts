import { z } from "zod";
import { applyOps, OpError, safeParseScript, type EditOp } from "@vibe/edl";
import { route, json, parseBody, ApiError, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { createVersion, currentScript, getOwnedProject, toVersionView } from "@/lib/editor/project-service";
import { resolveScriptUrls } from "@/lib/editor/urls";
import type { OpsResponse } from "@/lib/editor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  ops: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
  label: z.string().max(200).optional(),
  /**
   * Optional: the client's resulting script. Ops are still validated and applied
   * server-side, but when the client script parses it is stored verbatim so that
   * ids generated client-side (split/removeRange) stay identical on both sides.
   */
  script: z.unknown().optional(),
  /** Optimistic concurrency: refuse if the current version moved on. */
  baseVersionId: z.string().optional(),
});

/** POST /api/projects/[id]/ops {ops, label?, script?} -> {version, script} (creates a USER version). */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const body = await parseBody(req, Body);
  const { version: base, script } = await currentScript(project);
  if (body.baseVersionId && body.baseVersionId !== base.id) {
    throw new ApiError(409, "The project changed since your last edit", { currentVersionId: base.id });
  }
  let next;
  try {
    next = applyOps(script, body.ops as EditOp[]);
  } catch (e) {
    if (e instanceof OpError) throw new ApiError(400, e.message);
    throw e;
  }
  if (body.script !== undefined) {
    const parsed = safeParseScript(body.script);
    if (parsed.ok) next = parsed.script;
  }
  const label = body.label ?? describeOps(body.ops as EditOp[]);
  const version = await createVersion(project, next, { source: "USER", label, parentId: base.id });
  const res: OpsResponse = { version: toVersionView(version), script: await resolveScriptUrls(next) };
  return json(serialize(res));
});

function describeOps(ops: EditOp[]): string {
  const counts = new Map<string, number>();
  for (const op of ops) counts.set(op.op, (counts.get(op.op) ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(", ");
}
