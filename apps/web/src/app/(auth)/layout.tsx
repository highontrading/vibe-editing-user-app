import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Toaster } from "@/components/ui/toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-bg">
      <div className="relative flex w-full flex-col lg:w-[46%]">
        <div className="flex h-16 items-center px-8">
          <Link href="/landing" className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-4 w-4 text-accent" /> Vibe
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-8 pb-16">{children}</div>
        <div className="px-8 pb-6 text-[11px] text-muted">
          <Link href="/terms" className="hover:text-fg">Terms</Link> · <Link href="/privacy" className="hover:text-fg">Privacy</Link>
        </div>
      </div>
      <div className="film-visual hidden flex-1 lg:block">
        <div className="film-sprockets left" />
        <div className="film-sprockets right" />
        <div className="grain" />
        <div className="relative z-10 flex h-full flex-col justify-end p-14">
          <div className="max-w-md">
            <div className="font-display text-5xl leading-[1.05] text-white drop-shadow-lg">
              Drop your footage. <br />
              <span className="italic text-accent">Describe</span> the video. <br />
              Get a finished cut.
            </div>
            <p className="mt-5 text-sm text-white/70">Cuts, captions, music and titles, planned in plain words and built in minutes. Change anything by talking to the editor.</p>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
