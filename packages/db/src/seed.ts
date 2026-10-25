/** Seeds built-in recipes. Safe to re-run (upserts by slug). */
import { prisma } from "./index.js";
import { BUILTIN_RECIPES } from "./recipes.js";

async function main() {
  for (const r of BUILTIN_RECIPES) {
    const data = { ...r, defaults: r.defaults as object, isPublic: true };
    await prisma.recipe.upsert({
      where: { slug: r.slug },
      update: data,
      create: data,
    });
  }
  console.log(`Seeded ${BUILTIN_RECIPES.length} recipes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
