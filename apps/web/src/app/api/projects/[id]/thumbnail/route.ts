import { enqueue } from "@vibe/core";
import { route, json, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { ensureJobRunner } from "@/lib/jobs";
import { getOwnedProject, toJobView } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** POST /api/projects/[id]/thumbnail -> { job }. Enqueues `thumbnail`. */
export const POST = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await getOwnedProject(userId, id);
  await ensureJobRunner();
  const job = await enqueue("thumbnail", { projectId: id }, { userId, projectId: id });
  return json(serialize({ job: toJobView(job) }));
});
