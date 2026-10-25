"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Film, ListChecks, Sparkles, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api, cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Wand2,
    title: "Describe it. We cut it.",
    body: "Tell the editor what you want in plain words, or pick a recipe. It writes a plan, you approve, and a finished draft appears: cuts, captions, music, titles.",
    visual: "plan",
  },
  {
    icon: Upload,
    title: "Drop your footage",
    body: "Drag files or whole folders onto the prompt box. Uploads run in the background and every clip gets a transcript, scene list and a health check (silences, filler words, shaky shots).",
    visual: "upload",
  },
  {
    icon: ListChecks,
    title: "Approve the plan, then change anything",
    body: "Toggle any line of the plan off, change a style, or type a counter-instruction. After the draft, talk to the editor (“make the intro faster”) or touch the timeline. Everything is a version you can go back to.",
    visual: "approve",
  },
] as const;

function Visual({ kind }: { kind: (typeof STEPS)[number]["visual"] }) {
  if (kind === "plan")
    return (
      <div className="flex flex-col gap-2 p-5 text-xs">
        {["Hook: your line “most founders get this wrong” (0:42) opens the video.", "14 silences cut, 6 jump cuts on sentence breaks, punch-in zoom every ~10 s.", "Captions: Bold Pop, keywords highlighted in yellow.", "Music: upbeat lo-fi under speech, ducked. 3 whoosh SFX on cuts.", "Estimated length 48 s, 9:16."].map((t, i) => (
          <motion.div key={t} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }} className="flex items-start gap-2 rounded-lg border border-border bg-bg-2 px-3 py-2">
            <Check className="mt-0.5 h-3 w-3 text-success" /> <span className="text-fg/90">{t}</span>
          </motion.div>
        ))}
      </div>
    );
  if (kind === "upload")
    return (
      <div className="flex h-full flex-col justify-center gap-3 p-5">
        {["interview_take3.mov", "b-roll_desk.mp4", "intro.mp4"].map((n, i) => (
          <div key={n} className="rounded-lg border border-border bg-bg-2 p-2.5">
            <div className="flex items-center gap-2 text-xs">
              <Film className="h-3.5 w-3.5 text-muted" /> {n}
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/8">
              <motion.div initial={{ width: 0 }} animate={{ width: ["0%", "100%"] }} transition={{ duration: 1.6 + i * 0.4, delay: i * 0.3 }} className="h-full bg-accent" />
            </div>
          </div>
        ))}
      </div>
    );
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-5 text-xs">
      <div className="self-end rounded-2xl bg-fg px-3 py-2 text-bg">make the intro faster</div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="max-w-[85%] rounded-2xl bg-bg-2 px-3 py-2 text-fg/90">
        Trimmed 3 clips, moved the hook to 0:00, tightened 2 pauses. <span className="text-muted">Checkpoint v4 created.</span>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-1 flex flex-wrap gap-1">
        {["Tighten pacing", "Add a hook title", "Try Karaoke captions", "Make a 15 s cut"].map((c) => (
          <span key={c} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
            {c}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export function WelcomeTour({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [loading, setLoading] = React.useState<"sample" | "skip" | null>(null);
  const s = STEPS[step]!;

  async function loadSample() {
    setLoading("sample");
    try {
      toast.info("Generating a sample clip…", "This takes a few seconds.");
      const res = await api<{ projectId: string }>("/api/onboarding/sample", { method: "POST", json: {} });
      toast.success("Sample project ready");
      router.push(`/editor/${res.projectId}`);
    } catch (e) {
      toast.error("Could not create the sample", e instanceof Error ? e.message : undefined);
      setLoading(null);
    }
  }
  async function skip() {
    setLoading("skip");
    try {
      await api("/api/onboarding/complete", { method: "POST", json: {} });
      router.push("/home");
      router.refresh();
    } catch (e) {
      toast.error("Something went wrong", e instanceof Error ? e.message : undefined);
      setLoading(null);
    }
  }

  return (
    <div className="hero-glow flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted">
          <Sparkles className="h-4 w-4 text-accent" /> Welcome, {firstName}
        </div>
        <div className="grid overflow-hidden rounded-3xl border border-border bg-bg-2/60 md:grid-cols-2">
          <div className="flex flex-col p-8 md:p-10">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <button key={i} onClick={() => setStep(i)} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-8 bg-accent" : "w-4 bg-white/15 hover:bg-white/30")} aria-label={`Step ${i + 1}`} />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-8 flex-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <s.icon className="h-5 w-5" />
                </div>
                <h1 className="mt-5 font-display text-4xl leading-tight">{s.title}</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted">{s.body}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {step < STEPS.length - 1 ? (
                <Button variant="primary" size="lg" onClick={() => setStep(step + 1)}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="accent" size="lg" onClick={loadSample} loading={loading === "sample"}>
                  <Film className="h-4 w-4" /> Load sample project
                </Button>
              )}
              <Button variant="ghost" size="lg" onClick={skip} loading={loading === "skip"}>
                {step < STEPS.length - 1 ? "Skip tour" : "Start with my own footage"}
              </Button>
            </div>
            <div className="mt-3 text-[11px] text-muted">{step === STEPS.length - 1 ? "The sample is a generated 20 s clip, so you can see a finished edit in about 30 seconds." : `Step ${step + 1} of ${STEPS.length}`}</div>
          </div>
          <div className="relative min-h-[320px] border-t border-border bg-bg md:border-l md:border-t-0">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0">
                <Visual kind={s.visual} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
