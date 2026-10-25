import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Captions, Clapperboard, Music, ScanFace, ShieldCheck, Sparkles, Wand2, Workflow } from "lucide-react";
import { prisma } from "@vibe/db";
import { CAPTION_STYLES } from "@vibe/edl";
import { recipeToDTO } from "@/lib/dto";
import { planCatalog } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { PlanCards } from "@/components/billing/plan-cards";
import { CaptionStyleCard } from "@/components/brand/caption-style-card";
import { LandingRecipes } from "@/components/marketing/landing-recipes";
import { FaqList } from "@/components/marketing/faq";

export const metadata: Metadata = { title: "Vibe Editor — drop footage, describe the video, get a finished cut" };
export const revalidate = 300;

const FEATURES = [
  { icon: Wand2, title: "A plan you approve", text: "Before any work, the editor says what it will do: hook, cuts, captions, music, titles, length. Toggle lines, change styles, approve." },
  { icon: Captions, title: "12 caption styles", text: "Word-by-word captions synced to speech. Bold Pop, Hormozi, Karaoke, Handwritten and more; keywords highlighted, emoji optional." },
  { icon: Music, title: "Music that ducks itself", text: "Picked by mood, cut on the beat, ducked under speech and loudness-normalised. SFX on cuts and titles." },
  { icon: ScanFace, title: "Vertical from landscape", text: "Face-tracking reframe to 9:16, smart crop for 1:1 and 4:5, safe zones for every platform." },
  { icon: Workflow, title: "Edits that are versions", text: "Every chat edit and manual tweak is a checkpoint. Restore any, branch from any, undo just one AI decision." },
  { icon: ShieldCheck, title: "Self-checked before you see it", text: "Captions in the safe zone, audio not clipping, no black frames, length on target." },
];

const FAQ = [
  { q: "Do I need to know how to edit?", a: "No. Describe the result you want, or pick a recipe that says what footage to bring. You can still trim, split and move clips on the timeline if you like." },
  { q: "What footage works best?", a: "Anything from a phone or camera: talking to camera, screen recordings, b-roll, podcasts. Multi-gigabyte files are fine; uploads are resumable." },
  { q: "Is there a free plan?", a: "Yes: 10 minutes of export a month at 720p with a small watermark. Creator removes the watermark and unlocks 1080p." },
  { q: "Who owns the videos?", a: "You do. Your footage and exports are yours; delete them any time from the asset library or your account settings." },
  { q: "Can I change the edit after it is built?", a: "Yes. Tell the editor what to change (“swap the music to cinematic”, “remove the part where I cough”) or touch the timeline. Each change is a checkpoint you can go back to." },
];

export default async function LandingPage() {
  const rows = await prisma.recipe.findMany({ where: { isPublic: true }, orderBy: [{ isFeatured: "desc" }, { usageCount: "desc" }], take: 12 }).catch(() => []);
  const recipes = await Promise.all(rows.map(recipeToDTO));
  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="film-visual absolute inset-0 opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/70 to-bg" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-24 text-center md:pt-32">
          <div className="flex items-center gap-2 rounded-full border border-border bg-bg-2/70 px-3 py-1 text-xs text-muted backdrop-blur">
            <Sparkles className="h-3 w-3 text-accent" /> AI video editing that shows its plan first
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight md:text-7xl">
            Drop your footage. <span className="italic text-accent">Describe</span> the video. Get a finished cut.
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted md:text-lg">Cuts, captions, music and titles, planned in plain words and built in minutes. Change anything by talking to the editor or touching the timeline.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button variant="accent" size="lg">
                Start free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/landing#how">
              <Button variant="outline" size="lg">
                See how it works
              </Button>
            </Link>
          </div>
          <div className="mt-14 w-full max-w-3xl rounded-2xl border border-border bg-bg-2/80 p-5 text-left shadow-2xl backdrop-blur">
            <div className="text-[11px] uppercase tracking-wider text-muted">Your brief</div>
            <div className="mt-1 font-display text-xl">“Turn these three takes into a 45 s TikTok about pricing mistakes. Punchy, bold captions, lo-fi music.”</div>
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              {["Hook: “most founders get this wrong” (0:42) opens the video", "14 silences cut, 6 jump cuts, punch-in every ~10 s", "Bold Pop captions, keywords in yellow", "Lo-fi bed at −18 dB, ducked · 3 whooshes", "Title card at 0:00, end card with your handle", "Estimated 48 s · 9:16 · TikTok safe zones"].map((t) => (
                <div key={t} className="rounded-lg border border-border bg-bg-3/60 px-3 py-2 text-fg/90">
                  {t}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-muted">Toggle any line off · type a counter-instruction</div>
              <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black">Approve & build</span>
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-4xl">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { n: "01", title: "Drop footage, write a brief", text: "Drag files or folders, pick an aspect ratio and a style chip, or start from a recipe. Uploads run while you type." },
            { n: "02", title: "Approve the plan", text: "The editor reads transcripts, shots and audio, then proposes the edit in plain words. Change what you like and approve." },
            { n: "03", title: "Tweak by talking, export anywhere", text: "“Make the intro faster.” “Swap to Karaoke captions.” Export in 9:16, 16:9 and 1:1 from the same edit." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-bg-2 p-6">
              <div className="font-mono text-xs text-accent">{s.n}</div>
              <div className="mt-3 font-display text-2xl">{s.title}</div>
              <p className="mt-2 text-sm text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="border-y border-border/60 bg-bg-2/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-4xl">What the editor actually does</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-bg p-5">
                <f.icon className="h-5 w-5 text-accent" />
                <div className="mt-3 text-base font-semibold">{f.title}</div>
                <p className="mt-1.5 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CAPTION_STYLES.slice(0, 6).map((s) => (
              <CaptionStyleCard key={s.id} id={s.id} name={s.name} compact />
            ))}
          </div>
        </div>
      </section>

      {/* recipes */}
      <section id="recipes" className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-4xl">Recipes to remix</h2>
            <p className="mt-2 text-sm text-muted">Each one says what footage to bring and the sizes it comes in. Save your own from any finished project.</p>
          </div>
          <Link href="/signup" className="hidden items-center gap-1 text-sm text-muted hover:text-fg md:flex">
            Try one <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-8">{recipes.length ? <LandingRecipes recipes={recipes} /> : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">Recipes load once the database is seeded.</div>}</div>
      </section>

      {/* pricing teaser */}
      <section className="border-t border-border/60 bg-bg-2/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-4xl">Simple pricing</h2>
            <Link href="/pricing" className="text-sm text-muted hover:text-fg">
              Compare plans
            </Link>
          </div>
          <div className="mt-10">
            <PlanCards plans={planCatalog()} mode="marketing" />
          </div>
        </div>
      </section>

      {/* faq */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="font-display text-4xl">Questions</h2>
        <div className="mt-8">
          <FaqList items={FAQ} />
        </div>
        <div className="mt-14 rounded-3xl border border-accent/30 bg-accent/5 p-10 text-center">
          <Clapperboard className="mx-auto h-6 w-6 text-accent" />
          <div className="mt-3 font-display text-3xl">Film it. We&apos;ll cut it.</div>
          <Link href="/signup" className="mt-5 inline-block">
            <Button variant="accent" size="lg">
              Start free
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
