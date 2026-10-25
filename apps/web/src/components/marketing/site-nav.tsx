import Link from "next/link";
import { Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

export async function SiteNav() {
  const session = await auth();
  const signedIn = !!session?.user?.id;
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/landing" className="flex items-center gap-2 font-display text-xl">
          <Sparkles className="h-4 w-4 text-accent" /> Vibe
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          <Link href="/landing#how" className="hover:text-fg">
            How it works
          </Link>
          <Link href="/landing#recipes" className="hover:text-fg">
            Recipes
          </Link>
          <Link href="/pricing" className="hover:text-fg">
            Pricing
          </Link>
          <Link href="/changelog" className="hover:text-fg">
            Changelog
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/home">
              <Button variant="primary" size="sm">
                Open app
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm text-muted hover:text-fg sm:block">
                Sign in
              </Link>
              <Link href="/signup">
                <Button variant="accent" size="sm">
                  Start free
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-4 w-4 text-accent" /> Vibe
          </div>
          <p className="mt-2 text-xs text-muted">Drop your footage, describe the video, get a finished cut.</p>
        </div>
        {[
          { title: "Product", links: [["How it works", "/landing#how"], ["Recipes", "/landing#recipes"], ["Pricing", "/pricing"], ["Changelog", "/changelog"]] },
          { title: "Account", links: [["Sign in", "/login"], ["Create account", "/signup"], ["Help", "/help"]] },
          { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"]] },
        ].map((col) => (
          <div key={col.title}>
            <div className="text-xs font-medium uppercase tracking-wider text-muted">{col.title}</div>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-fg/80 hover:text-fg">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 py-5 text-center text-[11px] text-muted">© {new Date().getFullYear()} Vibe Editor. Made for people who would rather film than edit.</div>
    </footer>
  );
}
