"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Upload, Film, Music, Image as ImageIcon, Loader2, Check, AlertTriangle, Sparkles, Plus, Mic2, Scissors, VolumeX, Camera, Clapperboard } from "lucide-react";
import { ASPECTS, PLATFORM_PRESETS, PLATFORMS, type Platform } from "@vibe/edl";
import { api, cn, formatBytes } from "@/lib/utils";
import { fmtShort } from "@/lib/editor/format";
import { useEditor } from "@/lib/editor/store";
import { uploadToProject, type UploadProgress } from "@/lib/editor/uploader";
import type { AssetView, JobView, ProjectView } from "@/lib/editor/types";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

const TARGET_LENGTHS: { label: string; ms: number | null }[] = [
  { label: "Auto", ms: null },
  { label: "15 s", ms: 15000 },
  { label: "30 s", ms: 30000 },
  { label: "60 s", ms: 60000 },
  { label: "90 s", ms: 90000 },
  { label: "3 min", ms: 180000 },
  { label: "Full length", ms: 3600000 },
];

/** DRAFTING / ANALYZING / PLANNING: "Understanding your footage". */
export function FootagePanel() {
  const project = useEditor((s) => s.project);
  const syncProject = useEditor((s) => s.syncProject);
  const [uploads, setUploads] = React.useState<Record<string, UploadProgress>>({});
  const [dragging, setDragging] = React.useState(false);
  const [planning, setPlanning] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const [brief, setBrief] = React.useState(project?.brief ?? "");
  const briefTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => setBrief(project?.brief ?? ""), [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null;

  const patch = async (data: Partial<Pick<ProjectView, "brief" | "aspect" | "platform" | "targetDurationMs">>) => {
    try {
      const view = await api<ProjectView>(`/api/projects/${project.id}`, { method: "PATCH", json: data });
      syncProject(view);
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : undefined);
    }
  };

  const onBrief = (value: string) => {
    setBrief(value);
    if (briefTimer.current) clearTimeout(briefTimer.current);
    briefTimer.current = setTimeout(() => void patch({ brief: value }), 700);
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /^(video|audio|image)\//.test(f.type) || /\.(mp4|mov|webm|mkv|mp3|wav|m4a|png|jpe?g|webp)$/i.test(f.name));
    if (!list.length) return toast.error("Unsupported files", "Drop video, audio or image files.");
    await Promise.all(
      list.map(async (file) => {
        const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`;
        try {
          await uploadToProject(project.id, file, (p) => setUploads((u) => ({ ...u, [key]: p })));
          setTimeout(() => setUploads((u) => { const { [key]: _, ...rest } = u; return rest; }), 800);
          void useEditor.getState().refreshProject();
        } catch (e) {
          setUploads((u) => ({ ...u, [key]: { assetId: null, name: file.name, loaded: 0, total: file.size, status: "error", error: e instanceof Error ? e.message : "Upload failed" } }));
        }
      }),
    );
  };

  const assets = project.assets;
  const allReady = assets.length > 0 && assets.every((a) => a.status === "READY");
  const uploading = Object.values(uploads).some((u) => u.status !== "done" && u.status !== "error");
  const isPlanning = project.status === "PLANNING";
  const planJob = project.jobs.find((j) => j.type === "plan" && (j.status === "RUNNING" || j.status === "QUEUED"));
  const failedJob = project.status === "FAILED" ? project.jobs.find((j) => j.status === "FAILED") : null;

  const makePlan = async () => {
    setPlanning(true);
    try {
      const view = await api<ProjectView>(`/api/projects/${project.id}/plan`, { method: "POST", json: { brief, aspect: project.aspect, platform: project.platform, targetDurationMs: project.targetDurationMs } });
      syncProject(view);
    } catch (e) {
      toast.error("Couldn't start planning", e instanceof Error ? e.message : undefined);
    } finally {
      setPlanning(false);
    }
  };

  return (
    <div
      className={cn("relative h-full overflow-y-auto", dragging && "ring-2 ring-inset ring-accent/60")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
      }}
    >
      <input ref={fileInput} type="file" multiple accept="video/*,audio/*,image/*" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-bg/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-xl border border-accent/50 bg-bg-2 px-5 py-3 text-sm">
            <Upload className="h-4 w-4 text-accent" /> Drop to add footage
          </div>
        </div>
      )}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Step 1 of 3</div>
            <h1 className="mt-1 font-display text-3xl">Understanding your footage</h1>
            <p className="mt-1 text-sm text-muted">Each clip gets a transcript, shots and a health check. Write the brief while that runs.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
            <Plus className="h-3.5 w-3.5" /> Add footage
          </Button>
        </div>

        {failedJob && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">{failedJob.type === "plan" ? "Planning failed" : "Processing failed"}</div>
              <div className="text-xs opacity-80">{failedJob.error ?? project.statusMessage ?? "Try again."}</div>
            </div>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2">
          {assets.map((a) => (
            <AssetCard key={a.id} asset={a} job={project.jobs.find((j) => j.assetId === a.id && j.status !== "DONE") ?? project.jobs.find((j) => j.assetId === a.id) ?? null} />
          ))}
          {Object.entries(uploads).map(([k, u]) => (
            <UploadCard key={k} upload={u} />
          ))}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className={cn("flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted transition-colors hover:border-accent/50 hover:text-fg", assets.length === 0 && "sm:col-span-2 min-h-[180px]")}
          >
            <Upload className="h-5 w-5" />
            <span>{assets.length === 0 ? "Drop your clips here or click to browse" : "Add more clips"}</span>
            <span className="text-[11px] opacity-70">Video, audio, images · many files at once</span>
          </button>
        </section>

        <section className="rounded-xl border border-border bg-bg-2 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Your brief
          </div>
          <Textarea
            value={brief}
            onChange={(e) => onBrief(e.target.value)}
            placeholder="Describe the video you want. “A punchy 45-second talking-head short for TikTok: open with my strongest line, cut the silences, bold captions, lo-fi music.”"
            className="min-h-[110px] border-0 bg-bg px-3 py-2.5 text-sm leading-relaxed"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <LabeledSelect label="Aspect" value={project.aspect} onChange={(v) => patch({ aspect: v as ProjectView["aspect"] })} options={ASPECTS.map((a) => ({ value: a, label: a }))} />
            <LabeledSelect label="Platform" value={project.platform} onChange={(v) => patch({ platform: v, aspect: PLATFORM_PRESETS[v as Platform].aspect })} options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_PRESETS[p].label }))} />
            <LabeledSelect
              label="Target length"
              value={String(project.targetDurationMs ?? "")}
              onChange={(v) => patch({ targetDurationMs: v ? Number(v) : null })}
              options={TARGET_LENGTHS.map((t) => ({ value: t.ms === null ? "" : String(t.ms), label: t.label }))}
            />
          </div>
        </section>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-2 px-4 py-3">
          <div className="text-xs text-muted">
            {assets.length === 0 ? "Add at least one clip to continue." : allReady ? `${assets.length} clip${assets.length === 1 ? "" : "s"} analysed and ready.` : `Analysing ${assets.filter((a) => a.status !== "READY").length} of ${assets.length} clip${assets.length === 1 ? "" : "s"}…`}
          </div>
          <Button variant="accent" size="lg" disabled={!allReady || uploading || isPlanning || planning} onClick={makePlan} className="min-w-[160px]">
            {isPlanning || planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isPlanning ? (planJob?.message ?? "Planning…") : "Make the plan"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function LabeledSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
      {label}
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 bg-bg text-xs">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

const KIND_ICON = { VIDEO: Film, AUDIO: Music, IMAGE: ImageIcon } as const;

export function AssetCard({ asset, job }: { asset: AssetView; job: JobView | null }) {
  const Icon = KIND_ICON[asset.kind];
  const active = job && (job.status === "RUNNING" || job.status === "QUEUED");
  const h = asset.health;
  const status =
    asset.status === "READY" ? (
      <span className="inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" /> Ready</span>
    ) : asset.status === "FAILED" ? (
      <span className="inline-flex items-center gap-1 text-danger"><AlertTriangle className="h-3 w-3" /> Failed</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-accent"><Loader2 className="h-3 w-3 animate-spin" /> {job?.message ?? asset.analysisStep ?? (asset.status === "UPLOADING" ? "Uploading" : "Queued")}</span>
    );
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-2">
      <div className="relative aspect-[16/7] bg-bg-3">
        {asset.thumbUrl ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${asset.thumbUrl})` }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <Icon className="h-6 w-6 opacity-50" />
          </div>
        )}
        {asset.durationMs ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px]">{fmtShort(asset.durationMs)}</span> : null}
        {active && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <motion.div className="h-full bg-accent" animate={{ width: `${Math.max(4, job?.progress ?? 0)}%` }} />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium" title={asset.name}>{asset.name}</div>
            <div className="text-[11px] text-muted">
              {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
              {formatBytes(asset.sizeBytes)}
            </div>
          </div>
          <div className="shrink-0 text-[11px]">{status}</div>
        </div>
        {asset.error && <div className="mt-1 text-[11px] text-danger">{asset.error}</div>}
        {h && asset.status === "READY" && (
          <div className="mt-2.5 border-t border-border pt-2.5">
            {h.summary && <p className="mb-2 text-xs leading-relaxed text-muted">{h.summary}</p>}
            <div className="flex flex-wrap gap-1.5">
              <Stat icon={Clapperboard} label={`${h.shots} shot${h.shots === 1 ? "" : "s"}`} />
              <Stat icon={Mic2} label={`${h.words} words`} />
              <Stat icon={VolumeX} label={`${h.silences} silence${h.silences === 1 ? "" : "s"}`} tone={h.silences > 10 ? "warn" : undefined} />
              <Stat icon={Scissors} label={`${h.fillers} filler${h.fillers === 1 ? "" : "s"}`} tone={h.fillers > 5 ? "warn" : undefined} />
              {h.shaky > 0 && <Stat icon={Camera} label={`${h.shaky} shaky`} tone="warn" />}
              {h.dark > 0 && <Stat icon={Camera} label={`${h.dark} dark`} tone="warn" />}
            </div>
            {h.hooks.length > 0 && (
              <div className="mt-2 text-[11px] text-muted">
                <span className="font-medium text-fg">Best hook:</span> “{h.hooks[0]!.text}”
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: I, label, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; tone?: "warn" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]", tone === "warn" ? "border-accent/30 bg-accent/10 text-accent" : "border-border bg-bg-3 text-muted")}>
      <I className="h-3 w-3" /> {label}
    </span>
  );
}

function UploadCard({ upload }: { upload: UploadProgress }) {
  const pct = upload.total ? Math.round((upload.loaded / upload.total) * 100) : 0;
  return (
    <div className="flex min-h-[132px] flex-col justify-between rounded-xl border border-border bg-bg-2 p-3">
      <div className="flex items-center gap-2 text-sm">
        {upload.status === "error" ? <AlertTriangle className="h-4 w-4 text-danger" /> : <Loader2 className="h-4 w-4 animate-spin text-accent" />}
        <span className="truncate">{upload.name}</span>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[11px] text-muted">
          <span>{upload.status === "error" ? upload.error : upload.status === "uploading" ? `Uploading ${pct}%` : upload.status === "finishing" ? "Finishing…" : upload.status === "done" ? "Uploaded" : "Preparing…"}</span>
          <span>{formatBytes(upload.total)}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className={cn("h-full", upload.status === "error" ? "bg-danger" : "bg-accent")} style={{ width: `${upload.status === "error" ? 100 : pct}%` }} />
        </div>
      </div>
    </div>
  );
}
