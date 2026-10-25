/** thumbnail {projectId}: one still of the current script (15% in, 540 px wide) -> Project.thumbKey. */
import path from "node:path";
import { getStorage, storageKeys } from "@vibe/core";
import { prisma } from "@vibe/db";
import { parseScript } from "@vibe/edl";
import { prepareScriptForRender, renderScriptStill } from "../renderer";
import { jobScratch, rmrf } from "../util";
import { requireString, type JobContext } from "./common";

export async function thumbnailJob(ctx: JobContext) {
  const projectId = requireString(ctx.payload, "projectId");
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { current: true } });
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (!project.current) return { projectId, skipped: "no current version" };
  const script = parseScript(project.current.script);
  if (!script.output.durationMs) return { projectId, skipped: "empty script" };
  const dir = await jobScratch(`thumb-${projectId}`);
  try {
    await ctx.progress(10, "Rendering a preview frame…", true);
    const resolved = await prepareScriptForRender(script);
    const file = path.join(dir, "thumb.jpg");
    await renderScriptStill(resolved, { outputFile: file, timeMs: Math.floor(script.output.durationMs * 0.15), width: 540 });
    const key = storageKeys().thumbs(projectId, `${project.current.id}.jpg`);
    await getStorage().putFile(key, file, "image/jpeg");
    await prisma.project.update({ where: { id: projectId }, data: { thumbKey: key } });
    return { projectId, thumbKey: key, versionId: project.current.id };
  } finally {
    await rmrf(dir);
  }
}
