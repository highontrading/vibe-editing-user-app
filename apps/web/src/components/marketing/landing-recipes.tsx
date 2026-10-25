"use client";
import { RecipeRow } from "@/components/recipes/recipe-row";
import type { RecipeDTO } from "@/lib/types";

export function LandingRecipes({ recipes }: { recipes: RecipeDTO[] }) {
  return <RecipeRow title={<span className="sr-only">Recipes</span>} recipes={recipes} height={240} />;
}
