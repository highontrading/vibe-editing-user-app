import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { prisma } from "@vibe/db";
import { mediaUrl } from "@/lib/media-url";
import { formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const e = await prisma.export.findUnique({ where: { shareToken: token }, include: { project: { select: { title: true } } } });
  return { title: e ? `${e.project.title} · shared with Vibe` : "Shared video" };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const exp = await prisma.export.findUnique({ where: { shareToken: token }, include: { project: { select: { title: true, aspect: true, user: { select: { name: true } } } } } });
  if (!exp) notFound();
  const done = exp.status === "DONE" && exp.storageKey;
  const filename = `${exp.project.title.replace(/[^\w\- ]+/g, "").trim() || "video"}-${exp.preset}.mp4`;
  const [videoUrl, downloadUrl, posterUrl] = await Promise.all([done ? mediaUrl(exp.storageKey) : null, done ? mediaUrl(exp.storageKey, { download: filename }) : null, mediaUrl(exp.thumbKey)]);
  const portrait = exp.height > exp.width;
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs text-muted">Shared by {exp.project.user.name ?? "a Vibe user"}</div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{exp.project.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Badge>{exp.preset}</Badge>
            <Badge>
              {exp.width}×{exp.height}
            </Badge>
            <Badge>{exp.quality}</Badge>
            {exp.durationMs ? <span>· {formatDuration(exp.durationMs)}</span> : null}
            <span>· {new Date(exp.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        {downloadUrl && (
          <a href={downloadUrl}>
            <Button variant="accent">
              <Download className="h-4 w-4" /> Download
            </Button>
          </a>
        )}
      </div>
      <div className={portrait ? "mx-auto mt-8 max-w-sm" : "mt-8"}>
        <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-2xl" style={{ aspectRatio: `${exp.width} / ${exp.height}` }}>
          {videoUrl ? (
            <video src={videoUrl} poster={posterUrl ?? undefined} controls playsInline preload="metadata" className="h-full w-full" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
              {exp.status === "FAILED" ? (
                <>
                  <div className="text-sm">This export failed to render.</div>
                </>
              ) : (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <div className="text-sm">Still rendering. Check back in a minute.</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-dashed border-border p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4 text-muted" /> Comments
          </div>
          <p className="mt-2 text-sm text-muted">Timestamped comments are coming soon. For now, send feedback to whoever shared this link.</p>
        </div>
        <div className="rounded-2xl border border-border bg-bg-2 p-6">
          <div className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-4 w-4 text-accent" /> Made with Vibe
          </div>
          <p className="mt-2 text-xs text-muted">Drop your footage, describe the video, get a finished cut.</p>
          <Link href="/signup" className="mt-4 inline-block">
            <Button size="sm" variant="primary">
              Make your own
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
