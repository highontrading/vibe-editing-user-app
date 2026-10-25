"use client";
import * as React from "react";
import { Download, Lock, Loader2, Captions, Zap } from "lucide-react";
import { ASPECTS, PLATFORM_PRESETS, PLATFORMS, aspectOf, type Aspect, type Platform } from "@vibe/edl";
import { api, cn } from "@/lib/utils";
import { fmtShort } from "@/lib/editor/format";
import { useEditor } from "@/lib/editor/store";
import type { ExportView } from "@/lib/editor/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Toggle } from "../inspector/clip-inspector";

const QUALITIES = ["720p", "1080p", "4k"] as const;
type Quality = (typeof QUALITIES)[number];
const Q_RANK: Record<Quality, number> = { "720p": 0, "1080p": 1, "4k": 2 };
const Q_MULT: Record<Quality, number> = { "720p": 1, "1080p": 1, "4k": 2 };

export function ExportDialog() {
  const open = useEditor((s) => s.exportOpen);
  const set = useEditor((s) => s.set);
  const script = useEditor((s) => s.script);
  const project = useEditor((s) => s.project);
  const [preset, setPreset] = React.useState<Platform>("tiktok");
  const [quality, setQuality] = React.useState<Quality>("1080p");
  const [burn, setBurn] = React.useState(true);
  const [filename, setFilename] = React.useState("");
  const [extra, setExtra] = React.useState<Aspect[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open || !project) return;
    setPreset((script?.meta.platform ?? project.platform) as Platform);
    setFilename(project.title);
    setExtra([]);
    const max = project.user.maxResolution as Quality;
    setQuality(Q_RANK[max] >= 1 ? "1080p" : max);
  }, [open, project, script]);

  if (!script || !project) return null;
  const plan = project.user;
  const maxQ = plan.maxResolution as Quality;
  const currentAspect = aspectOf(script.output.width, script.output.height);
  const outputs = 1 + extra.filter((a) => a !== currentAspect).length;
  const minutes = ((script.output.durationMs / 60000) * Q_MULT[quality] * outputs);
  const remaining = Math.max(0, plan.minutesQuota - plan.minutesUsed);
  const overQuota = minutes > remaining;

  const submit = async () => {
    setBusy(true);
    try {
      await useEditor.getState().flush();
      const res = await api<{ exports: ExportView[] }>(`/api/projects/${project.id}/exports`, { method: "POST", json: { preset, quality, burnCaptions: burn, filename: filename.trim() || undefined, aspects: extra } });
      useEditor.getState().setExports([...res.exports, ...useEditor.getState().exports]);
      set({ exportOpen: false, exportPanelOpen: true });
      void useEditor.getState().refreshProject();
      toast.success(`${res.exports.length} export${res.exports.length === 1 ? "" : "s"} started`, "You can keep editing while they render.");
    } catch (e) {
      toast.error("Couldn't start the export", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => set({ exportOpen: false })} title={<span className="inline-flex items-center gap-2"><Download className="h-4 w-4" /> Export</span>} width="max-w-2xl">
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Platform preset</div>
            <div className="grid grid-cols-4 gap-1.5">
              {PLATFORMS.map((p) => {
                const info = PLATFORM_PRESETS[p];
                return (
                  <button key={p} type="button" onClick={() => setPreset(p)} className={cn("flex flex-col items-start gap-0.5 rounded-lg border p-2 text-left", preset === p ? "border-accent bg-accent/10" : "border-border bg-bg-3 hover:border-white/25")}>
                    <span className="text-xs font-medium">{info.label}</span>
                    <span className="font-mono text-[10px] text-muted">{info.aspect} · ≤{fmtShort(info.maxDurationMs)}</span>
                  </button>
                );
              })}
            </div>
            {PLATFORM_PRESETS[preset].aspect !== currentAspect && preset !== "custom" && (
              <div className="mt-1.5 text-[11px] text-accent">Your edit is {currentAspect}; {PLATFORM_PRESETS[preset].label} prefers {PLATFORM_PRESETS[preset].aspect}. Tick it under “Also export as”.</div>
            )}
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Resolution</div>
            <div className="grid grid-cols-3 gap-1.5">
              {QUALITIES.map((q) => {
                const locked = Q_RANK[q] > Q_RANK[maxQ];
                return (
                  <button key={q} type="button" disabled={locked} onClick={() => setQuality(q)} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-xs", quality === q ? "border-accent bg-accent/10" : "border-border bg-bg-3 hover:border-white/25", locked && "opacity-50")} title={locked ? `Upgrade to export in ${q}` : undefined}>
                    <span className="font-medium">{q === "4k" ? "4K" : q}</span>
                    {locked ? <Lock className="h-3 w-3 text-muted" /> : <span className="font-mono text-[10px] text-muted">{q === "4k" ? "2× minutes" : "1×"}</span>}
                  </button>
                );
              })}
            </div>
            {plan.watermark && <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted"><Zap className="h-3 w-3 text-accent" /> Free plan exports carry a small watermark. Upgrade for clean 1080p and 4K.</div>}
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border bg-bg-3 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-2"><Captions className="h-3.5 w-3.5 text-muted" /> Burn captions into the video<span className="block text-[10px] text-muted">Off: an .srt file is produced instead</span></span>
            <Toggle checked={burn} onChange={setBurn} />
          </label>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Filename</div>
            <Input value={filename} onChange={(e) => setFilename(e.target.value)} className="h-8 text-xs" placeholder={project.title} />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Also export as</div>
            <div className="flex flex-col gap-1">
              {ASPECTS.filter((a) => a !== currentAspect).map((a) => {
                const on = extra.includes(a);
                return (
                  <label key={a} className={cn("flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-xs", on ? "border-accent/60 bg-accent/10" : "border-border bg-bg-3")}>
                    <span><span className="font-medium">{a}</span><span className="ml-1.5 text-[10px] text-muted">saved as version “Export {a}”</span></span>
                    <input type="checkbox" checked={on} onChange={(e) => setExtra(e.target.checked ? [...extra, a] : extra.filter((x) => x !== a))} className="accent-[#ffd400]" />
                  </label>
                );
              })}
            </div>
            <div className="mt-1 text-[10px] text-muted">One edit, many outputs. Reframing is applied per aspect.</div>
          </div>
          <div className="rounded-lg border border-border bg-bg-3 p-3 text-xs">
            <div className="flex justify-between"><span className="text-muted">Outputs</span><span className="font-mono">{outputs} × {fmtShort(script.output.durationMs)}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted">Estimated minutes</span><span className={cn("font-mono", overQuota && "text-danger")}>{minutes.toFixed(1)}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted">Remaining this cycle</span><span className="font-mono">{remaining.toFixed(1)} / {plan.minutesQuota}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className={cn("h-full", overQuota ? "bg-danger" : "bg-accent")} style={{ width: `${Math.min(100, ((plan.minutesUsed + minutes) / Math.max(1, plan.minutesQuota)) * 100)}%` }} />
            </div>
            {overQuota && <div className="mt-1.5 text-[10px] text-danger">This export exceeds your remaining minutes on the {plan.label} plan.</div>}
          </div>
          <Button variant="accent" size="lg" onClick={submit} disabled={busy} className="mt-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export {outputs > 1 ? `${outputs} videos` : "video"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
