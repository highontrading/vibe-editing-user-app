import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@vibe/db";

/** Server-side: current user id or null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Server components: redirect to /login if not signed in. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  return user;
}

/** Route handlers: throws an ApiError(401) if not signed in. */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new ApiError(401, "Sign in required");
  return id;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
