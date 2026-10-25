"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Clock, Film, Paperclip, RectangleHorizontal, Upload, X } from "lucide-react";
import { Chip } from "@/components/ui/tabs";
import { PillSelect } from "@/components/ui/segmented";
import { Kbd } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { Dropzone, FilePicker } from "@/components/upload/dropzone";
import { uploadFiles } from "@/lib/upload";
import { api, cn, formatBytes } from "@/lib/utils";
import { ASPECT_OPTIONS, LENGTH_OPTIONS, STYLE_CHIPS, detectPlatform } from "@/lib/options";
import type { ProjectDTO } from "@/lib/types";

const VERBS = ["product demo", "vlog", "talking-head", "montage", "explainer", "launch video", "podcast clip", "ad", "tutorial"];

export function HeroPrompt({ firstName, defaultAspect }: { firstName: string; defaultAspect?: string }) {
  const router = useRouter();
  const [brief, setBrief] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [aspect, setAspect] = React.useState<string>(defaultAspect && defaultAspect !== "auto" ? defaultAspect : "auto");
  const [length, setLength] = React.useState<number>(0);
  const [style, setStyle] = React.useState<string | null>(null);
  const [verbIdx, setVerbIdx] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // rotate the verb unless a style chip is chosen
  React.useEffect(() => {
    if (style) return;
    const t = setInterval(() => setVerbIdx((i) => (i + 1) % VERBS.length), 2800);
    return () => clearInterval(t);
  }, [style]);

  // "/" focuses the prompt
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chip = STYLE_CHIPS.find((c) => c.id === style);
  const verb = chip ? chip.verb : VERBS[verbIdx];
  const canSubmit = (brief.trim().length > 0 || files.length > 0) && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const detected = detectPlatform(brief);
      const project = await api<ProjectDTO>("/api/projects", {
        method: "POST",
        json: {
          brief: brief.trim(),
          aspect,
          platform: detected?.platform ?? chip?.platform,
          targetDurationMs: length,
          recipeSlug: chip?.recipeSlug ?? undefined,
        },
      });
      if (files.length) {
        toast.info(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}`, "You can keep working while they upload.");
        void uploadFiles(files, { projectId: project.id });
      }
      toast.success("Project created", project.title);
      router.push(`/editor/${project.id}`);
    } catch (e) {
      toast.error("Could not create project", e instanceof Error ? e.message : undefined);
      setSubmitting(false);
    }
  }

  const addFiles = (fs: File[]) => {
    setFiles((cur) => {
      const names = new Set(cur.map((f) => `${f.name}:${f.size}`));
      return [...cur, ...fs.filter((f) => !names.has(`${f.name}:${f.size}`))];
    });
    ref.current?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
      <h1 className="text-center font-display text-4xl leading-tight tracking-tight md:text-[44px]">
        Let&apos;s cut your{" "}
        <span className="relative inline-block min-w-[6ch] text-left">
          <AnimatePresence mode="wait">
            <motion.span key={verb} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className={cn("inline-block", chip ? "text-accent" : "italic text-accent")}>
              {verb}
            </motion.span>
          </AnimatePresence>
        </span>
        , {firstName}
      </h1>
      <p className="mt-2 text-sm text-muted">Describe your video or bring in your media to get started.</p>

      <Dropzone onFiles={addFiles} className="mt-7 w-full rounded-2xl" activeClassName="">
        <div className={cn("relative rounded-2xl border border-border bg-bg-2/80 shadow-[0_20px_60px_-30px_rgba(0,0,0,.9)] backdrop-blur transition-colors focus-within:border-white/25")}>
          <div className="absolute -top-3 left-5">
            <FilePicker onFiles={addFiles} className="flex h-11 w-14 items-center justify-center rounded-xl border border-dashed border-border bg-bg-2 text-muted transition-colors hover:border-white/30 hover:text-fg" multiple>
              <Upload className="h-4 w-4" />
            </FilePicker>
          </div>
          <textarea
            ref={ref}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Describe your video, or drop footage…"
            rows={3}
            className="w-full resize-none bg-transparent px-5 pb-3 pt-10 text-[15px] leading-relaxed text-fg placeholder:text-muted focus:outline-none"
          />
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-border bg-bg-3 py-1 pl-2.5 pr-1.5 text-xs">
                  <Film className="h-3 w-3 shrink-0 text-muted" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-muted">{formatBytes(f.size)}</span>
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="rounded-full p-0.5 text-muted hover:bg-white/10 hover:text-fg" aria-label="Remove">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 px-3 pb-3">
            <FilePicker onFiles={addFiles} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-white/6 hover:text-fg" multiple>
              <Paperclip className="h-3.5 w-3.5" /> Add files
            </FilePicker>
            <div className="flex-1" />
            <PillSelect value={aspect} onChange={setAspect} options={ASPECT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} icon={RectangleHorizontal} title="Aspect ratio" />
            <PillSelect value={length} onChange={setLength} options={LENGTH_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} icon={Clock} title="Target length" />
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              title="Create project (⌘ + Enter)"
              className={cn("ml-1 flex h-8 w-8 items-center justify-center rounded-lg transition-colors", canSubmit ? "bg-fg text-bg hover:bg-white/90" : "bg-white/8 text-muted")}
              aria-label="Create project"
            >
              {submitting ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </Dropzone>

      <div className="no-scrollbar mt-3 flex w-full gap-1.5 overflow-x-auto px-1 pb-1">
        {STYLE_CHIPS.map((c) => (
          <Chip key={c.id} active={style === c.id} onClick={() => setStyle((s) => (s === c.id ? null : c.id))} className="shrink-0">
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="mt-4 hidden items-center gap-3 text-[11px] text-muted md:flex">
        <span className="flex items-center gap-1">
          <Kbd>/</Kbd> focus
        </span>
        <span className="flex items-center gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd> create
        </span>
      </div>
    </div>
  );
}
