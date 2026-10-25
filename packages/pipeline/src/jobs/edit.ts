/**
 * edit {projectId, messageId}: a chat instruction -> new ScriptVersion.
 * Convention with the web app: the web inserts the USER message and a
 * placeholder ASSISTANT message { status: "pending", data: { userMessageId } }.
 * This job fills that placeholder (or creates one if missing).
 */
import { prisma, type Message } from "@vibe/db";
import { parseScript, scriptSummary } from "@vibe/edl";
import { editScript, type ChatTurn } from "@vibe/agent";
import { createContext } from "../context";
import { media } from "../media-provider";
import { errorMessage, json } from "../util";
import { requireString, type JobContext } from "./common";

const HISTORY_LENGTH = 20;

async function findPendingReply(projectId: string, userMessageId: string): Promise<Message | null> {
  return prisma.message.findFirst({
    where: { projectId, role: "ASSISTANT", status: "pending", data: { path: ["userMessageId"], equals: userMessageId } },
    orderBy: { createdAt: "desc" },
  });
}

export async function editJob(ctx: JobContext) {
  const projectId = requireString(ctx.payload, "projectId");
  const messageId = requireString(ctx.payload, "messageId");
  const userMessage = await prisma.message.findUnique({ where: { id: messageId } });
  if (!userMessage || userMessage.projectId !== projectId) throw new Error(`Message ${messageId} not found in project ${projectId}`);
  const instruction = userMessage.content.trim();

  let reply = await findPendingReply(projectId, messageId);
  if (!reply) {
    reply = await prisma.message.create({ data: { projectId, role: "ASSISTANT", content: "", status: "pending", data: { userMessageId: messageId } } });
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { current: true } });
    if (!project) throw new Error(`Project ${projectId} not found`);
    if (!project.current) throw new Error("There is no draft to edit yet. Approve the plan to build one first.");
    const current = parseScript(project.current.script);

    await ctx.progress(10, "Reading the conversation…", true);
    const previous = await prisma.message.findMany({
      where: { projectId, createdAt: { lt: userMessage.createdAt }, status: "done", role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LENGTH,
    });
    const history: ChatTurn[] = previous.reverse().map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content }));

    await ctx.progress(25, "Working on it…", true);
    const context = await createContext(projectId);
    const result = await editScript(context, current, instruction, history, media);
    const script = parseScript(result.script);

    await ctx.progress(85, "Saving a checkpoint…", true);
    const version = await prisma.scriptVersion.create({
      data: { projectId, parentId: project.current.id, source: "AGENT", script: json(script), summary: result.summary || scriptSummary(script), label: instruction.slice(0, 200) },
    });
    await prisma.$transaction([
      prisma.project.update({ where: { id: projectId }, data: { currentVersionId: version.id, status: "READY", statusMessage: null } }),
      prisma.message.update({
        where: { id: reply.id },
        data: {
          content: result.message,
          status: "done",
          versionId: version.id,
          data: json({ userMessageId: messageId, ops: result.ops, summary: result.summary, checks: result.checks, suggestions: result.suggestions, versionId: version.id }),
        },
      }),
    ]);
    return { projectId, versionId: version.id, replyId: reply.id, ops: result.ops.length };
  } catch (e) {
    const err = errorMessage(e).slice(0, 500);
    await prisma.message
      .update({ where: { id: reply.id }, data: { status: "error", content: `Sorry, I couldn't do that: ${err}`, data: { userMessageId: messageId, error: err } } })
      .catch(() => {});
    throw e;
  }
}
