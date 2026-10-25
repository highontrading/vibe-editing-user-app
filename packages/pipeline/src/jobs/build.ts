/** build {projectId}: approved plan -> first EditScript version (READY) + assistant message + thumbnail job. */
import { enqueue } from "@vibe/core";
import { prisma } from "@vibe/db";
import { PlanSchema, parseScript, scriptSummary } from "@vibe/edl";
import { buildScript } from "@vibe/agent";
import { createContext } from "../context";
import { media } from "../media-provider";
import { errorMessage, json } from "../util";
import { requireString, type JobContext } from "./common";

export async function buildJob(ctx: JobContext) {
  const projectId = requireString(ctx.payload, "projectId");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (!project.plan) throw new Error("This project has no plan yet. Run the plan step first.");
  await prisma.project.update({ where: { id: projectId }, data: { status: "BUILDING", statusMessage: "Building your draft…" } });
  try {
    const plan = PlanSchema.parse(project.plan);
    await ctx.progress(10, "Gathering footage…", true);
    const context = await createContext(projectId);
    await ctx.progress(25, "Cutting your draft…", true);
    const result = await buildScript(context, plan, media);
    const script = parseScript(result.script);
    await ctx.progress(85, "Saving the draft…", true);
    const version = await prisma.scriptVersion.create({
      data: {
        projectId,
        parentId: project.currentVersionId,
        source: "AGENT",
        script: json(script),
        summary: scriptSummary(script),
        label: "Built from plan",
      },
    });
    const [, message] = await prisma.$transaction([
      prisma.project.update({ where: { id: projectId }, data: { currentVersionId: version.id, status: "READY", statusMessage: null } }),
      prisma.message.create({
        data: {
          projectId,
          role: "ASSISTANT",
          content: result.summary,
          data: json({ checks: result.checks, suggestions: result.suggestions, versionId: version.id }),
          versionId: version.id,
          status: "done",
        },
      }),
    ]);
    await enqueue("thumbnail", { projectId }, { userId: project.userId, projectId }).catch((e) => console.warn("[pipeline:build] thumbnail enqueue failed", errorMessage(e)));
    return { projectId, versionId: version.id, messageId: message.id };
  } catch (e) {
    const err = errorMessage(e).slice(0, 500);
    await prisma.project.update({ where: { id: projectId }, data: { status: "FAILED", statusMessage: `Build failed: ${err}` } }).catch(() => {});
    await prisma.message.create({ data: { projectId, role: "ASSISTANT", content: `I couldn't build the draft: ${err}`, status: "error", data: json({ error: err }) } }).catch(() => {});
    throw e;
  }
}
