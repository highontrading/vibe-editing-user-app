import { NextResponse } from "next/server";
import { prisma } from "@vibe/db";
import { getStorage, slugify } from "@vibe/core";
import { aspectOf } from "@vibe/edl";
import { route, ApiError } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { getOwnedProject } from "@/lib/editor/project-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; exportId: string }> };

/** GET /api/projects/[id]/exports/[exportId]/download[?srt=1] -> 302 to the storage URL with a download filename */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUserId();
  const { id, exportId } = await ctx.params;
  const project = await getOwnedProject(userId, id);
  const exp = await prisma.export.findFirst({ where: { id: exportId, projectId: id } });
  if (!exp) throw new ApiError(404, "Export not found");
  const srt = new URL(req.url).searchParams.get("srt") === "1";
  const key = srt ? exp.srtKey : exp.storageKey;
  if (!key) throw new ApiError(409, srt ? "No captions file for this export yet" : "Export is not finished yet");
  const base = `${slugify(project.title)}-${aspectOf(exp.width, exp.height).replace(":", "x")}-${exp.quality}`;
  const url = await getStorage().getUrl(key, { download: srt ? `${base}.srt` : `${base}.mp4` });
  return NextResponse.redirect(url, { status: 302 });
});
