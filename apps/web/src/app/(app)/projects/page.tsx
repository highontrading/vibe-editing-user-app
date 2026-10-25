import type { Metadata } from "next";
import { prisma } from "@vibe/db";
import { requireUser } from "@/lib/session";
import { projectInclude, projectToDTO } from "@/lib/dto";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();
  const rows = await prisma.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 100, include: projectInclude });
  return <ProjectsView initial={await Promise.all(rows.map(projectToDTO))} />;
}
