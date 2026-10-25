import { z } from "zod";
import { json, parseBody, route } from "@/lib/api";
import { answerHelp, FAQ } from "@/lib/help";

export const runtime = "nodejs";

export const GET = route(async () => json({ faq: FAQ.map(({ id, question, answer, category }) => ({ id, question, answer, category })) }));

export const POST = route(async (req: Request) => {
  const { message } = await parseBody(req, z.object({ message: z.string().min(1).max(2000) }));
  const res = await answerHelp(message);
  return json({ answer: res.answer, matched: res.matched ? { id: res.matched.id, question: res.matched.question } : null, related: res.related, fromModel: res.fromModel });
});
