import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { FAQ } from "@/lib/help";
import { HelpView } from "@/components/help/help-view";

export const metadata: Metadata = { title: "Help" };

export default async function HelpPage() {
  await requireUser();
  return <HelpView faq={FAQ.map(({ id, question, answer, category }) => ({ id, question, answer, category }))} />;
}
