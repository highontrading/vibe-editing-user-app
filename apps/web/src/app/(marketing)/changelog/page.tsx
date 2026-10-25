import type { Metadata } from "next";
import { CHANGELOG } from "@/content/changelog";
import { Badge } from "@/components/ui/card";

export const metadata: Metadata = { title: "Changelog" };

const TONE = { new: "accent", improved: "info", fixed: "success" } as const;

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-display text-5xl tracking-tight">Changelog</h1>
      <p className="mt-3 text-muted">Updated every release. What shipped, what got better, what we fixed.</p>
      <div className="mt-12 flex flex-col gap-12">
        {CHANGELOG.map((e) => (
          <article key={e.version} className="grid gap-4 md:grid-cols-[140px_1fr]">
            <div className="text-sm text-muted">
              <div className="font-mono text-fg">v{e.version}</div>
              <time dateTime={e.date}>{new Date(e.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>
            </div>
            <div>
              <h2 className="font-display text-3xl">{e.title}</h2>
              <p className="mt-2 text-sm text-muted">{e.summary}</p>
              <ul className="mt-4 flex flex-col gap-2">
                {e.changes.map((c, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Badge tone={TONE[c.type]} className="mt-0.5 w-[72px] shrink-0 justify-center capitalize">
                      {c.type}
                    </Badge>
                    <span className="text-fg/90">{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
