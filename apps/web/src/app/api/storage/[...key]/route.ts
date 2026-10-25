/**
 * Local storage driver routes: GET streams objects (with Range support for video),
 * PUT accepts browser uploads. With S3 configured, browsers talk to S3 directly and
 * GET redirects to a signed URL.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import mime from "mime";
import { getStorage } from "@vibe/core";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keyFrom(params: { key: string[] }) {
  return params.key.map(decodeURIComponent).join("/");
}

export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = keyFrom(await ctx.params);
  const storage = getStorage();
  const url = new URL(req.url);
  const download = url.searchParams.get("download") ?? undefined;
  if (storage.driver === "s3") {
    return NextResponse.redirect(await storage.getUrl(key, { download }));
  }
  const file = storage.localPath(key);
  if (!file) return new NextResponse("Not found", { status: 404 });
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(file);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const type = mime.getType(file) || "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="${download}"`;
  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), stat.size - 1) : Math.min(start + 8 * 1024 * 1024, stat.size - 1);
    if (start >= stat.size) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
    headers["Content-Length"] = String(end - start + 1);
    const stream = fs.createReadStream(file, { start, end });
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
  }
  headers["Content-Length"] = String(stat.size);
  return new NextResponse(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { status: 200, headers });
}

export async function PUT(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const key = keyFrom(await ctx.params);
  // Users may only write under their own prefix.
  if (!key.startsWith(`users/${session.user.id}/`)) return new NextResponse("Forbidden", { status: 403 });
  const storage = getStorage();
  if (storage.driver !== "local") return new NextResponse("Use direct upload", { status: 400 });
  if (!req.body) return new NextResponse("Empty body", { status: 400 });
  await storage.put(key, Readable.fromWeb(req.body as never), req.headers.get("content-type") ?? undefined);
  return new NextResponse(null, { status: 200, headers: { ETag: `"${Date.now()}"` } });
}
