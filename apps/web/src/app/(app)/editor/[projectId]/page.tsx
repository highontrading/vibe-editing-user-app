import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@vibe/db";
import { requireUser } from "@/lib/session";
import { buildProjectView } from "@/lib/editor/project-service";
import { Editor } from "@/components/editor/editor";
import "@/components/editor/editor.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ projectId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { title: true } });
  return { title: p ? `${p.title} · Editor` : "Editor" };
}

export default async function EditorPage({ params }: Props) {
  const user = await requireUser();
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== user.id) notFound();
  const view = await buildProjectView(project);
  // Serialise Dates/BigInts the same way the API does so SWR's fallbackData matches.
  const initial = JSON.parse(JSON.stringify(view, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
  return <Editor projectId={projectId} initial={initial} />;
}
