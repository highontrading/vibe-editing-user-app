import { prisma } from "@vibe/db";
import { route, json, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getOwnedProject } from "@/lib/editor/project-service";
import type { MessageView } from "@/lib/editor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/projects/[id]/messages?after=ISO -> { messages: MessageView[] } oldest first */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await getOwnedProject(userId, id);
  const after = new URL(req.url).searchParams.get("after");
  const rows = await prisma.message.findMany({
    where: { projectId: id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const messages: MessageView[] = rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    data: (m.data as MessageView["data"]) ?? null,
    versionId: m.versionId,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  }));
  return json(serialize({ messages }));
});
