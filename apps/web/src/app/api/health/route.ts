import { NextResponse } from "next/server";
import { prisma } from "@vibe/db";
import { env } from "@vibe/core";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    db = e instanceof Error ? e.message : "error";
  }
  return NextResponse.json({
    ok: db === "ok",
    db,
    queue: env.redisUrl ? "redis" : "inline",
    storage: env.s3 ? "s3" : "local",
    ai: env.mockAi ? "mock" : "claude",
    time: new Date().toISOString(),
  });
}
