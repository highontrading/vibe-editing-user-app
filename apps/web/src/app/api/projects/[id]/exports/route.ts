import { z } from "zod";
import { prisma } from "@vibe/db";
import { enqueue, PLAN_LIMITS, slugify, type PlanId } from "@vibe/core";
import { ASPECTS, ASPECT_SIZES, PLATFORMS, applyOp, aspectOf, type Aspect } from "@vibe/edl";
import { route, json, parseBody, serialize } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { ensureJobRunner } from "@/lib/jobs";
import { createVersion, currentScript, getOwnedProject, toExportView } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const QUALITIES = ["720p", "1080p", "4k"] as const;
const SHORT_SIDE: Record<(typeof QUALITIES)[number], number> = { "720p": 720, "1080p": 1080, "4k": 2160 };

function exportFilename(title: string, aspect: string, quality: string) {
  return `${slugify(title)}-${aspect.replace(":", "x")}-${quality}.mp4`;
}

/** GET /api/projects/[id]/exports -> { exports: ExportView[] } newest first */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const rows = await prisma.export.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 50 });
  const jobIds = rows.map((r) => r.jobId).filter((x): x is string => !!x);
  const jobs = jobIds.length ? await prisma.job.findMany({ where: { id: { in: jobIds } } }) : [];
  const views = await Promise.all(rows.map((r) => toExportView(r, jobs.find((j) => j.id === r.jobId) ?? null, exportFilename(project.title, aspectOf(r.width, r.height), r.quality))));
  return json(serialize({ exports: views }));
});

const Body = z.object({
  preset: z.enum(PLATFORMS).default("custom"),
  quality: z.enum(QUALITIES).default("1080p"),
  burnCaptions: z.boolean().default(true),
  filename: z.string().max(120).optional(),
  /** Additional aspects to export; each becomes its own version ("Export 16:9") + Export row. */
  aspects: z.array(z.enum(ASPECTS)).default([]),
});

/** POST /api/projects/[id]/exports -> { exports: ExportView[] }. Creates QUEUED Export rows (watermark per plan) and enqueues `render` per export. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const body = await parseBody(req, Body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } });
  const limits = PLAN_LIMITS[user.plan as PlanId] ?? PLAN_LIMITS.FREE;
  const allowed = QUALITIES.slice(0, QUALITIES.indexOf(limits.maxResolution) + 1);
  const quality = allowed.includes(body.quality) ? body.quality : limits.maxResolution;
  const { version: base, script } = await currentScript(project);
  const currentAspect = aspectOf(script.output.width, script.output.height);

  const targets: { aspect: Aspect; versionId: string; width: number; height: number }[] = [];
  const sizeFor = (w: number, h: number) => {
    const short = SHORT_SIDE[quality];
    const scale = short / Math.min(w, h);
    return { width: Math.round((w * scale) / 2) * 2, height: Math.round((h * scale) / 2) * 2 };
  };
  targets.push({ aspect: currentAspect, versionId: base.id, ...sizeFor(script.output.width, script.output.height) });
  for (const aspect of body.aspects) {
    if (aspect === currentAspect) continue;
    const size = ASPECT_SIZES[aspect];
    const copy = applyOp(script, { op: "setOutput", width: size.width, height: size.height });
    copy.meta = { ...copy.meta, aspect };
    const v = await createVersion(project, copy, { source: "USER", label: `Export ${aspect}`, parentId: base.id, makeCurrent: false });
    targets.push({ aspect, versionId: v.id, ...sizeFor(size.width, size.height) });
  }

  await ensureJobRunner();
  const created = [];
  for (const t of targets) {
    const exp = await prisma.export.create({
      data: {
        projectId: id,
        versionId: t.versionId,
        preset: body.preset,
        width: t.width,
        height: t.height,
        fps: script.output.fps,
        burnCaptions: body.burnCaptions,
        quality,
        status: "QUEUED",
        watermark: limits.watermark,
        durationMs: script.output.durationMs,
      },
    });
    let job = null;
    try {
      job = await enqueue("render", { exportId: exp.id }, { userId, projectId: id });
      await prisma.export.update({ where: { id: exp.id }, data: { jobId: job.id } });
    } catch (e) {
      await prisma.export.update({ where: { id: exp.id }, data: { status: "FAILED" } });
      console.error("[exports] enqueue failed", e);
    }
    created.push(await toExportView({ ...exp, jobId: job?.id ?? null }, job, body.filename ? `${slugify(body.filename)}-${t.aspect.replace(":", "x")}.mp4` : exportFilename(project.title, t.aspect, quality)));
  }
  if (project.status === "READY") {
    await prisma.project.update({ where: { id }, data: { status: "EXPORTING", statusMessage: "Exporting…" } });
  }
  return json(serialize({ exports: created }));
});
