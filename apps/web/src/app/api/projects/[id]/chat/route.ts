import { z } from "zod";
import { prisma } from "@vibe/db";
import { enqueue } from "@vibe/core";
import { route, json, parseBody, ApiError, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { ensureJobRunner } from "@/lib/jobs";
import { getOwnedProject } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ content: z.string().trim().min(1).max(4000) });

/**
 * POST /api/projects/[id]/chat {content}
 * Creates the USER message plus a pending ASSISTANT placeholder (status "pending",
 * data {userMessageId}) and enqueues `edit` {projectId, messageId: userMessage.id}.
 * The pipeline must fill the placeholder (content/data/versionId) and set status "done" | "error".
 */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  if (!project.currentVersionId) throw new ApiError(409, "Build a draft before chatting with the editor");
  const { content } = await parseBody(req, Body);
  const userMessage = await prisma.message.create({ data: { projectId: id, role: "USER", content, status: "done" } });
  const assistantMessage = await prisma.message.create({
    data: { projectId: id, role: "ASSISTANT", content: "", status: "pending", data: { userMessageId: userMessage.id } },
  });
  await ensureJobRunner();
  let job = null;
  try {
    job = await enqueue("edit", { projectId: id, messageId: userMessage.id }, { userId, projectId: id });
    await prisma.message.update({ where: { id: assistantMessage.id }, data: { data: { userMessageId: userMessage.id, jobId: job.id } } });
  } catch (e) {
    await prisma.message.update({
      where: { id: assistantMessage.id },
      data: { status: "error", content: "The editor could not start this edit.", data: { userMessageId: userMessage.id, error: e instanceof Error ? e.message : String(e) } },
    });
  }
  return json(serialize({ userMessage, assistantMessage, job }));
});
