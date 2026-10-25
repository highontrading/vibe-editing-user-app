import { prisma } from "@vibe/db";
import { json, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { jobToDTO } from "@/lib/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const job = await prisma.job.findUnique({ where: { id }, include: { project: { select: { userId: true } } } });
  if (!job) throw new ApiError(404, "Job not found");
  if (job.userId && job.userId !== userId) throw new ApiError(403, "Forbidden");
  if (!job.userId && job.project && job.project.userId !== userId) throw new ApiError(403, "Forbidden");
  return json(jobToDTO(job));
});
