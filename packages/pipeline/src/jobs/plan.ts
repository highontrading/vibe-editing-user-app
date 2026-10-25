/** plan {projectId}: footage + brief -> plain-words plan (Project.plan, PLAN_READY) + assistant message. */
import { prisma } from "@vibe/db";
import { PlanSchema } from "@vibe/edl";
import { createPlan } from "@vibe/agent";
import { createContext } from "../context";
import { errorMessage, json } from "../util";
import { requireString, type JobContext } from "./common";

export async function planJob(ctx: JobContext) {
  const projectId = requireString(ctx.payload, "projectId");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project ${projectId} not found`);
  await prisma.project.update({ where: { id: projectId }, data: { status: "PLANNING", statusMessage: "Planning your edit…" } });
  try {
    await ctx.progress(10, "Reading your footage…", true);
    const context = await createContext(projectId);
    if (!context.assets.length) throw new Error("No ready footage to plan with. Upload a clip first.");
    await ctx.progress(30, "Planning your edit…", true);
    const result = await createPlan(context);
    const plan = PlanSchema.parse(result.plan);
    await ctx.progress(90, "Writing up the plan…", true);
    const [, message] = await prisma.$transaction([
      prisma.project.update({
        where: { id: projectId },
        data: {
          plan: json(plan),
          status: "PLAN_READY",
          statusMessage: null,
          aspect: plan.aspect,
          platform: plan.platform,
          targetDurationMs: plan.targetDurationMs ?? project.targetDurationMs,
        },
      }),
      prisma.message.create({ data: { projectId, role: "ASSISTANT", content: result.message, data: json({ plan }), status: "done" } }),
    ]);
    return { projectId, messageId: message.id, steps: plan.steps.length };
  } catch (e) {
    await prisma.project.update({ where: { id: projectId }, data: { status: "FAILED", statusMessage: `Planning failed: ${errorMessage(e).slice(0, 300)}` } }).catch(() => {});
    throw e;
  }
}
