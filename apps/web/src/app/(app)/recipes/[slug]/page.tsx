import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Film, Music, Palette, Sparkles, Type } from "lucide-react";
import { prisma } from "@vibe/db";
import { CAPTION_STYLES, COLOR_PRESET_INFO, MUSIC_MOOD_INFO } from "@vibe/edl";
import { requireUser } from "@/lib/session";
import { recipeToDTO } from "@/lib/dto";
import { formatDuration } from "@/lib/utils";
import { gradientFor } from "@/lib/options";
import { Badge } from "@/components/ui/card";
import { RemixButton } from "@/components/recipes/remix-dialog";
import { RecipeCard } from "@/components/recipes/recipe-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await prisma.recipe.findUnique({ where: { slug }, select: { title: true } });
  return { title: r?.title ?? "Recipe" };
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const row = await prisma.recipe.findUnique({ where: { slug } });
  if (!row || (!row.isPublic && row.ownerId !== user.id)) notFound();
  const recipe = await recipeToDTO(row);
  const d = recipe.defaults as { captionStyle?: string; musicMood?: string; colorPreset?: string; targetDurationMs?: number; platform?: string };
  const caption = CAPTION_STYLES.find((c) => c.id === d.captionStyle);
  const mood = MUSIC_MOOD_INFO.find((m) => m.id === d.musicMood);
  const color = COLOR_PRESET_INFO.find((c) => c.id === d.colorPreset);
  const relatedRows = await prisma.recipe.findMany({ where: { id: { not: row.id }, OR: [{ isPublic: true }, { ownerId: user.id }] }, orderBy: [{ category: row.category === "" ? "asc" : "asc" }, { usageCount: "desc" }], take: 8 });
  const related = (await Promise.all(relatedRows.map(recipeToDTO))).sort((a, b) => Number(b.category === recipe.category) - Number(a.category === recipe.category)).slice(0, 5);
  const isVideo = recipe.previewUrl && /\.(mp4|webm|mov)(\?|$)/i.test(recipe.previewUrl);

  return (
    <div className="px-8 py-8 md:px-12">
      <Link href="/recipes" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" /> All recipes
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-3" style={{ background: recipe.previewUrl ? undefined : gradientFor(recipe.slug) }}>
          <div className={recipe.sizes[0] === "16:9" ? "aspect-video" : recipe.sizes[0] === "1:1" ? "aspect-square" : "aspect-[4/5]"}>
            {recipe.previewUrl ? (
              isVideo ? (
                <video src={recipe.previewUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={recipe.previewUrl} alt="" className="h-full w-full object-cover" />
              )
            ) : (
              <div className="flex h-full flex-col justify-end p-6">
                <div className="font-display text-4xl text-white drop-shadow">{recipe.title}</div>
                <div className="mt-1 text-sm text-white/70">{recipe.category}</div>
              </div>
            )}
          </div>
          <div className="grain" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{recipe.category}</Badge>
            {recipe.isFeatured && <Badge tone="accent">Featured</Badge>}
            {!recipe.isPublic && <Badge tone="info">Private · yours</Badge>}
            {recipe.usesGenerative && (
              <Badge tone="accent">
                <Sparkles className="mr-1 h-2.5 w-2.5" /> Uses generative AI
              </Badge>
            )}
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">{recipe.title}</h1>
          <p className="mt-3 max-w-xl text-base text-muted">{recipe.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <RemixButton recipe={recipe} />
            <div className="text-xs text-muted">{recipe.usageCount > 0 ? `Used ${recipe.usageCount} time${recipe.usageCount === 1 ? "" : "s"}` : "Be the first to use it"}</div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-bg-2 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
                <Film className="h-3.5 w-3.5" /> What to bring
              </div>
              <div className="mt-2 text-sm">{recipe.bring}</div>
            </div>
            <div className="rounded-xl border border-border bg-bg-2 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
                <Clock className="h-3.5 w-3.5" /> Sizes & length
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                {recipe.sizes.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
                {d.targetDurationMs && <span className="text-muted">· about {formatDuration(d.targetDurationMs)}</span>}
                {d.platform && <span className="text-muted">· {d.platform}</span>}
              </div>
            </div>
            {caption && (
              <div className="rounded-xl border border-border bg-bg-2 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
                  <Type className="h-3.5 w-3.5" /> Captions
                </div>
                <div className="mt-2 text-sm">{caption.name}</div>
                <div className="text-xs text-muted">{caption.description}</div>
              </div>
            )}
            {(mood || color) && (
              <div className="rounded-xl border border-border bg-bg-2 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
                  <Music className="h-3.5 w-3.5" /> Music & look
                </div>
                <div className="mt-2 text-sm">
                  {mood && (
                    <>
                      {mood.name} <span className="text-muted">({mood.description})</span>
                    </>
                  )}
                </div>
                {color && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <Palette className="h-3 w-3" /> {color.name}: {color.description}
                  </div>
                )}
              </div>
            )}
          </div>

          <details className="mt-6 rounded-xl border border-border bg-bg-2">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">How the editor will approach it</summary>
            <p className="whitespace-pre-line border-t border-border px-4 py-3 text-sm leading-relaxed text-muted">{recipe.prompt}</p>
          </details>
          {recipe.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {recipe.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-3 text-sm font-semibold">More like this</h2>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {related.map((r) => (
              <RecipeCard key={r.id} recipe={r} variant="row" height={200} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
