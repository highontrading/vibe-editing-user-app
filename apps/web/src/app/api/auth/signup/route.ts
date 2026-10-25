import { z } from "zod";
import { createUserWithPassword } from "@/auth";
import { ApiError, json, parseBody, route } from "@/lib/api";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().email().max(200), password: z.string().min(8).max(200), name: z.string().max(80).optional() });

export const POST = route(async (req: Request) => {
  const body = await parseBody(req, Body);
  try {
    const user = await createUserWithPassword(body);
    return json({ id: user.id, email: user.email, name: user.name });
  } catch (e) {
    throw new ApiError(409, e instanceof Error ? e.message : "Could not create account");
  }
});
