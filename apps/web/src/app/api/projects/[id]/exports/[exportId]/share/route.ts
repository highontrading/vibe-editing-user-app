import crypto from "node:crypto";
import { prisma } from "@vibe/db";
import { env } from "@vibe/core";
import { route, json, ApiError, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getOwnedProject } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; exportId: string }> };

/** POST /api/projects/[id]/exports/[exportId]/share -> { shareToken, shareUrl } (idempotent) */
export const POST = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id, exportId } = await ctx.params;
  await getOwnedProject(userId, id);
  const exp = await prisma.export.findFirst({ where: { id: exportId, projectId: id } });
  if (!exp) throw new ApiError(404, "Export not found");
  let token = exp.shareToken;
  if (!token) {
    token = crypto.randomBytes(12).toString("base64url");
    await prisma.export.update({ where: { id: exportId }, data: { shareToken: token } });
  }
  return json(serialize({ shareToken: token, shareUrl: `${env.appUrl}/share/${token}` }));
});
