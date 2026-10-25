import type { Metadata } from "next";
import { prisma } from "@vibe/db";
import { requireUser } from "@/lib/session";
import { recipeToDTO } from "@/lib/dto";
import { PageHeader } from "@/components/page-header";
import { RecipeGallery } from "@/components/recipes/recipe-gallery";

export const metadata: Metadata = { title: "Recipes" };
export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const user = await requireUser();
  const rows = await prisma.recipe.findMany({ where: { OR: [{ isPublic: true }, { ownerId: user.id }] }, orderBy: [{ isFeatured: "desc" }, { usageCount: "desc" }, { createdAt: "desc" }] });
  const recipes = await Promise.all(rows.map(recipeToDTO));
  return (
    <div className="px-8 py-10 md:px-12">
      <PageHeader eyebrow="Recipes" title="Pick a recipe to remix" description="Each recipe is an editing style with its own pacing, captions and music. Bring the footage it asks for, add a twist, and it runs." />
      <RecipeGallery recipes={recipes} />
    </div>
  );
}
