"use client";
import * as React from "react";
import { AlertTriangle, Timer, Sparkles } from "lucide-react";
import { ASPECTS, ASPECT_SIZES, COLOR_PRESET_INFO, PLATFORMS, PLATFORM_PRESETS, aspectOf, type Aspect, type Platform } from "@vibe/edl";
import { api, cn } from "@/lib/utils";
import { fmtShort } from "@/lib/editor/format";
import { useEditor } from "@/lib/editor/store";
import type { ProjectView } from "@/lib/editor/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Field, Section, Slider } from "../panel";
import { ColorSwatch } from "./clip-inspector";

const TARGETS = [15000, 30000, 45000, 60000, 90000, 180000];

export function GlobalInspector() {
  const script = useEditor((s) => s.script);
  const project = useEditor((s) => s.project);
  const applyOps = useEditor((s) => s.applyOps);
  const enqueueChat = useEditor((s) => s.enqueueChat);
  const [title, setTitle] = React.useState(script?.meta.title ?? "");
  React.useEffect(() => setTitle(script?.meta.title ?? ""), [script?.meta.title]);
  if (!script || !project) return null;
  const aspect = aspectOf(script.output.width, script.output.height);

  const patchProject = async (data: Partial<Pick<ProjectView, "platform" | "targetDurationMs" | "aspect">>) => {
    try {
      const view = await api<ProjectView>(`/api/projects/${project.id}`, { method: "PATCH", json: data });
      useEditor.getState().syncProject(view);
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : undefined);
    }
  };

  const setAspect = (a: Aspect) => {
    if (a === aspect) return;
    const size = ASPECT_SIZES[a];
    applyOps([{ op: "setOutput", width: size.width, height: size.height }], `Output ${a}`);
    void patchProject({ aspect: a });
    toast.info(`Output is now ${a}`, "Clips keep their framing: use Reframe on each clip, or ask the editor to “reframe for " + a + "”.");
  };

  return (
    <div className="flex flex-col">
      <Section title="Colour preset">
        <div className="grid grid-cols-4 gap-1.5">
          {COLOR_PRESET_INFO.map((p) => (
            <button key={p.id} type="button" title={p.description} onClick={() => applyOps([{ op: "setColorPreset", preset: p.id }], `Look: ${p.name}`)} className={cn("flex flex-col items-center gap-1 rounded-md border p-1 text-[9px]", script.global.colorPreset === p.id ? "border-accent/60 bg-accent/10 text-accent" : "border-border bg-bg-2 text-muted hover:text-fg")}>
              <ColorSwatch preset={p.id} className="h-7 w-full rounded" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
        <Field label="Grain" hint={script.global.grain.toFixed(2)}>
          <Slider min={0} max={1} step={0.05} value={script.global.grain} onChange={(v) => applyOps([{ op: "setGlobal", patch: { grain: v } }], "Grain", { coalesce: "global:grain" })} />
        </Field>
        <Field label="Vignette" hint={script.global.vignette.toFixed(2)}>
          <Slider min={0} max={1} step={0.05} value={script.global.vignette} onChange={(v) => applyOps([{ op: "setGlobal", patch: { vignette: v } }], "Vignette", { coalesce: "global:vignette" })} />
        </Field>
      </Section>

      <Section title="Output">
        <Field label="Aspect ratio" hint={`${script.output.width}×${script.output.height} · ${script.output.fps} fps`}>
          <div className="grid grid-cols-4 gap-1">
            {ASPECTS.map((a) => {
              const s = ASPECT_SIZES[a];
              return (
                <button key={a} type="button" onClick={() => setAspect(a)} className={cn("flex flex-col items-center gap-1 rounded-md border p-1.5 text-[10px] font-medium", aspect === a ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-bg-2 text-muted hover:text-fg")}>
                  <span className="block border border-current/60" style={{ width: Math.round((s.width / Math.max(s.width, s.height)) * 18), height: Math.round((s.height / Math.max(s.width, s.height)) * 18) }} />
                  {a}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="flex items-start gap-1.5 text-[10px] text-muted"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-accent" /> Changing the aspect keeps clip framing; reframe clips afterwards or ask the editor to do it.</div>
        <Field label="Platform target">
          <Select value={project.platform} onChange={(e) => patchProject({ platform: e.target.value as Platform })} className="h-8 text-xs">
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{PLATFORM_PRESETS[p].label} · {PLATFORM_PRESETS[p].aspect} · max {fmtShort(PLATFORM_PRESETS[p].maxDurationMs)}</option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Length">
        <Field label="Target length" hint={project.targetDurationMs ? fmtShort(project.targetDurationMs) : "auto"}>
          <div className="flex flex-wrap gap-1">
            {TARGETS.map((t) => (
              <button key={t} type="button" onClick={() => patchProject({ targetDurationMs: t })} className={cn("rounded-md border px-2 py-1 text-[10px] font-medium", project.targetDurationMs === t ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-bg-2 text-muted hover:text-fg")}>{fmtShort(t)}</button>
            ))}
            <button type="button" onClick={() => patchProject({ targetDurationMs: null })} className={cn("rounded-md border px-2 py-1 text-[10px] font-medium", !project.targetDurationMs ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-bg-2 text-muted hover:text-fg")}>Auto</button>
          </div>
        </Field>
        <div className="flex items-center justify-between rounded-md border border-border bg-bg-2 px-2.5 py-2 text-xs">
          <span className="text-muted">Current <span className="font-mono text-fg">{fmtShort(script.output.durationMs)}</span></span>
          <Button size="sm" variant="secondary" disabled={!project.targetDurationMs} onClick={() => { enqueueChat(`Trim the edit to ${Math.round((project.targetDurationMs ?? 0) / 1000)} seconds, keeping the strongest moments.`); useEditor.getState().set({ chatOpen: true }); }} title="Asks the editor to trim to the target length">
            <Timer className="h-3 w-3" /> Fit to length
          </Button>
        </div>
      </Section>

      <Section title="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== (script.meta.title ?? "") && applyOps([{ op: "setMeta", patch: { title } }], "Title")} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} placeholder="Video title (used by title cards)" className="h-8 text-xs" />
        <div className="flex items-start gap-1.5 text-[10px] text-muted"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent" /> Recipe: {project.recipeId ?? "none"} · Loudness target {script.meta.targetLufs} LUFS</div>
      </Section>
    </div>
  );
}
