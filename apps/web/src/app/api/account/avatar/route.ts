/** POST multipart/form-data { file } -> stores the avatar and sets User.image. */
import { prisma } from "@vibe/db";
import { getStorage } from "@vibe/core";
import { json, route } from "@/lib/api";
import { requireUserId, ApiError } from "@/lib/session";
import { mediaUrl } from "@/lib/media-url";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Expected a file");
  if (!file.type.startsWith("image/")) throw new ApiError(400, "Avatar must be an image");
  if (file.size > 5 * 1024 * 1024) throw new ApiError(400, "Avatar must be under 5 MB");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `users/${userId}/avatar-${Date.now()}.${ext}`;
  await getStorage().put(key, Buffer.from(await file.arrayBuffer()), file.type);
  const image = await mediaUrl(key);
  await prisma.user.update({ where: { id: userId }, data: { image } });
  return json({ image });
});
