import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "./session";

export { ApiError };

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Wrap a route handler: catches ApiError/ZodError and returns JSON errors. */
export function route<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message, details: e.details ?? null }, { status: e.status });
      if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request", details: e.issues }, { status: 400 });
      console.error("[api]", e);
      const message = e instanceof Error ? e.message : "Unexpected error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Expected JSON body");
  }
  return schema.parse(body);
}

/** Serialise Prisma rows (BigInt, Date) for JSON responses. */
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
  ) as T;
}
