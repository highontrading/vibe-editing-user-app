/**
 * Server-only helpers shared by the editor API routes: ownership checks,
 * view serialisation, version creation.
 */
import "server-only";
import { prisma, type Asset, type Job, type Project, type ScriptVersion, type User, type Export, type Prisma } from "@vibe/db";
import { PLAN_LIMITS, type PlanId } from "@vibe/core";
import { parseScript, safeParseScript, scriptSummary, type AssetAnalysis, type EditScript, type Plan } from "@vibe/edl";
import { ApiError } from "@/lib/session";
import { resolveMediaUrl, resolveScriptUrls } from "./urls";
import type { AssetHealth, AssetView, ExportView, JobView, ProjectView, UserPlanView, VersionView, VersionWithScript } from "./types";

export async function getOwnedProject(userId: string, projectId: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== userId) throw new ApiError(404, "Project not found");
  return project;
}

export function toJobView(j: Job): JobView {
  return {
    id: j.id,
    type: j.type,
    status: j.status,
    progress: j.progress,
    message: j.message,
    error: j.error,
    assetId: j.assetId,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export function toVersionView(v: ScriptVersion): VersionView {
  return { id: v.id, parentId: v.parentId, source: v.source, summary: v.summary, label: v.label, createdAt: v.createdAt.toISOString() };
}

export async function toVersionWithScript(v: ScriptVersion, resolve = true): Promise<VersionWithScript> {
  const parsed = safeParseScript(v.script);
  const raw = parsed.ok ? parsed.script : (v.script as unknown as EditScript);
  const script = resolve ? await resolveScriptUrls(raw) : raw;
  return { ...toVersionView(v), script };
}

export function assetHealth(analysis: unknown): AssetHealth | null {
  if (!analysis || typeof analysis !== "object") return null;
  const a = analysis as Partial<AssetAnalysis>;
  const silences = a.audio?.silences ?? [];
  return {
    durationMs: a.durationMs ?? 0,
    silences: silences.length,
    silenceMs: silences.reduce((n, s) => n + Math.max(0, s.endMs - s.startMs), 0),
    fillers: a.quality?.fillers?.length ?? 0,
    shots: a.shots?.length ?? 0,
    shaky: a.quality?.shaky?.length ?? 0,
    dark: a.quality?.dark?.length ?? 0,
    words: a.transcript?.words?.length ?? 0,
    speakers: a.transcript?.speakers?.length ?? 0,
    summary: a.summary ?? null,
    hooks: a.hooks ?? [],
    language: a.language ?? null,
  };
}

export async function toAssetView(a: Asset): Promise<AssetView> {
  const [url, proxyUrl, thumbUrl, waveformUrl] = await Promise.all([
    resolveMediaUrl(a.storageKey),
    resolveMediaUrl(a.proxyKey),
    resolveMediaUrl(a.thumbKey),
    resolveMediaUrl(a.waveformKey),
  ]);
  return {
    id: a.id,
    kind: a.kind,
    source: a.source,
    name: a.name,
    mime: a.mime,
    sizeBytes: Number(a.sizeBytes),
    status: a.status,
    error: a.error,
    durationMs: a.durationMs,
    width: a.width,
    height: a.height,
    fps: a.fps,
    analysisStep: a.analysisStep,
    health: assetHealth(a.analysis),
    url: url ?? "",
    proxyUrl,
    thumbUrl,
    waveformUrl,
    createdAt: a.createdAt.toISOString(),
  };
}

export function userPlanView(user: Pick<User, "plan" | "minutesQuota" | "minutesUsed">): UserPlanView {
  const limits = PLAN_LIMITS[user.plan as PlanId] ?? PLAN_LIMITS.FREE;
  return {
    plan: user.plan,
    label: limits.label,
    maxResolution: limits.maxResolution,
    watermark: limits.watermark,
    minutesQuota: user.minutesQuota,
    minutesUsed: user.minutesUsed,
  };
}

export async function buildProjectView(project: Project): Promise<ProjectView> {
  const [assets, current, jobs, user, versionCount, exportCount] = await Promise.all([
    prisma.asset.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } }),
    project.currentVersionId ? prisma.scriptVersion.findUnique({ where: { id: project.currentVersionId } }) : Promise.resolve(null),
    prisma.job.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.user.findUnique({ where: { id: project.userId }, select: { plan: true, minutesQuota: true, minutesUsed: true } }),
    prisma.scriptVersion.count({ where: { projectId: project.id } }),
    prisma.export.count({ where: { projectId: project.id } }),
  ]);
  // Jobs for this project's assets (ingest/analyze carry assetId but may lack projectId).
  const assetIds = assets.map((a) => a.id);
  const assetJobs = assetIds.length
    ? await prisma.job.findMany({ where: { assetId: { in: assetIds }, projectId: null }, orderBy: { createdAt: "desc" }, take: 25 })
    : [];
  const allJobs = [...jobs, ...assetJobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    statusMessage: project.statusMessage,
    brief: project.brief,
    aspect: project.aspect,
    platform: project.platform,
    targetDurationMs: project.targetDurationMs,
    recipeId: project.recipeId,
    plan: (project.plan as Plan | null) ?? null,
    currentVersionId: project.currentVersionId,
    thumbUrl: await resolveMediaUrl(project.thumbKey),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    assets: await Promise.all(assets.map(toAssetView)),
    currentVersion: current ? await toVersionWithScript(current) : null,
    jobs: allJobs.map(toJobView),
    user: userPlanView(user ?? { plan: "FREE", minutesQuota: 10, minutesUsed: 0 }),
    versionCount,
    exportCount,
  };
}

/** Current script of a project (unresolved URLs), or an ApiError if there is none. */
export async function currentScript(project: Project): Promise<{ version: ScriptVersion; script: EditScript }> {
  if (!project.currentVersionId) throw new ApiError(409, "Project has no edit yet");
  const version = await prisma.scriptVersion.findUnique({ where: { id: project.currentVersionId } });
  if (!version) throw new ApiError(409, "Current version missing");
  return { version, script: parseScript(version.script) };
}

/** Persist a new ScriptVersion and make it current. */
export async function createVersion(
  project: Project,
  script: EditScript,
  opts: { source: "USER" | "AGENT" | "RECIPE" | "IMPORT"; label?: string | null; parentId?: string | null; makeCurrent?: boolean },
): Promise<ScriptVersion> {
  const version = await prisma.scriptVersion.create({
    data: {
      projectId: project.id,
      parentId: opts.parentId ?? project.currentVersionId ?? null,
      source: opts.source,
      script: script as unknown as Prisma.InputJsonValue,
      summary: scriptSummary(script),
      label: opts.label ?? null,
    },
  });
  if (opts.makeCurrent !== false) {
    await prisma.project.update({ where: { id: project.id }, data: { currentVersionId: version.id } });
  }
  return version;
}

export async function toExportView(e: Export, job: Job | null, filename?: string): Promise<ExportView> {
  const name = filename ?? `export-${e.id}.mp4`;
  const [url, thumbUrl, srtUrl] = await Promise.all([resolveMediaUrl(e.storageKey), resolveMediaUrl(e.thumbKey), resolveMediaUrl(e.srtKey, { download: name.replace(/\.mp4$/i, ".srt") })]);
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    id: e.id,
    versionId: e.versionId,
    preset: e.preset,
    width: e.width,
    height: e.height,
    fps: e.fps,
    burnCaptions: e.burnCaptions,
    quality: e.quality,
    status: e.status,
    watermark: e.watermark,
    durationMs: e.durationMs,
    sizeBytes: e.sizeBytes === null ? null : Number(e.sizeBytes),
    shareToken: e.shareToken,
    shareUrl: e.shareToken ? `${appUrl}/share/${e.shareToken}` : null,
    url,
    downloadUrl: e.storageKey ? `/api/projects/${e.projectId}/exports/${e.id}/download` : null,
    thumbUrl,
    srtUrl,
    job: job ? toJobView(job) : null,
    createdAt: e.createdAt.toISOString(),
    finishedAt: e.finishedAt ? e.finishedAt.toISOString() : null,
  };
}
