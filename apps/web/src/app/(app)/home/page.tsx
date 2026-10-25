import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@vibe/db";
import { requireUser } from "@/lib/session";
import { projectInclude, projectToDTO, recipeToDTO } from "@/lib/dto";
import { HeroPrompt } from "@/components/home/hero-prompt";
import { HomeTabs } from "@/components/home/home-tabs";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  if (!user.onboarded) redirect("/welcome");
  const [recipeRows, projectRows] = await Promise.all([
    prisma.recipe.findMany({ where: { OR: [{ isPublic: true }, { ownerId: user.id }] }, orderBy: [{ isFeatured: "desc" }, { usageCount: "desc" }] }),
    prisma.project.findMany({ where: { userId: user.id, archived: false }, orderBy: { updatedAt: "desc" }, take: 12, include: projectInclude }),
  ]);
  const [recipes, projects] = await Promise.all([Promise.all(recipeRows.map(recipeToDTO)), Promise.all(projectRows.map(projectToDTO))]);
  const firstName = (user.name ?? user.email.split("@")[0] ?? "there").split(/\s+/)[0]!;
  const prefs = (user.preferences as { defaultAspect?: string }) ?? {};
  return (
    <div className="min-h-full">
      <section className="hero-glow flex min-h-[62vh] items-center px-8 py-16 md:px-12">
        <HeroPrompt firstName={firstName} defaultAspect={prefs.defaultAspect} />
      </section>
      <HomeTabs recipes={recipes} projects={projects} />
    </div>
  );
}
