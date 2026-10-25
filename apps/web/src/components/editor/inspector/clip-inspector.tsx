"use client";
import * as React from "react";
import { Scissors, Copy, Trash2, HelpCircle, AlignCenter, AlignLeft, AlignRight, Volume2, VolumeX } from "lucide-react";
import { COLOR_PRESET_INFO, EFFECTS, TRANSITIONS, type EffectType, type TransitionType, type ColorPreset } from "@vibe/edl";
import { clipDuration } from "@vibe/edl";
import { cn } from "@/lib/utils";
import { fmtDb, fmtShort, fmtTime } from "@/lib/editor/format";
import { useEditor, useSelectedAudio, useSelectedClip } from "@/lib/editor/store";
import { deleteSelection, duplicateSelection, splitAtPlayhead } from "@/lib/editor/commands";
import { Button } from "@/components/ui/button";
import { Field, Section, SegmentedControl, Slider } from "../panel";
import { audioClipLength } from "../timeline/tracks";

const PUNCH_INS = [1, 1.1, 1.25, 1.5];
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const EFFECT_PARAM: Partial<Record<EffectType, { key: string; min: number; max: number; step: number; default: number; label: string }>> = {
  grain: { key: "amount", min: 0, max: 1, step: 0.05, default: 0.3, label: "Amount" },
  vignette: { key: "amount", min: 0, max: 1, step: 0.05, default: 0.4, label: "Amount" },
  blur: { key: "px", min: 0, max: 40, step: 1, default: 8, label: "Pixels" },
  lightLeak: { key: "intensity", min: 0, max: 1, step: 0.05, default: 0.5, label: "Intensity" },
  shake: { key: "intensity", min: 0, max: 1, step: 0.05, default: 0.3, label: "Intensity" },
  zoomPulse: { key: "amount", min: 0, max: 0.3, step: 0.01, default: 0.08, label: "Amount" },
};

export function ClipInspector() {
  const sel = useSelectedClip();
  const script = useEditor((s) => s.script);
  const applyOps = useEditor((s) => s.applyOps);
  if (!sel || !script) return null;
  const { clip, track } = sel;
  const asset = script.assets[clip.assetId];
  const dur = clipDuration(clip);
  const id = clip.id;
  const outW = script.output.width;
  const colorFx = clip.effects.find((e) => e.type === "colorGrade");
  const colorPreset = (colorFx?.params.preset as ColorPreset | undefined) ?? "none";

  const setTransform = (patch: { scale?: number; x?: number; y?: number; rotate?: number }, key: string) => applyOps([{ op: "setClipTransform", clipId: id, transform: patch }], "Transform", { coalesce: `${id}:${key}` });

  return (
    <div className="flex flex-col">
      <Section title="Clip" right={<span className="font-mono text-[10px] text-muted">{track.layer === 0 ? "Main" : `B-roll ${track.layer}`}</span>}>
        <div>
          <div className="truncate text-sm font-medium" title={clip.label ?? asset?.name}>{clip.label ?? asset?.name ?? clip.assetId}</div>
          <div className="mt-0.5 font-mono text-[10px] text-muted">
            {fmtTime(clip.startMs)} → {fmtTime(clip.startMs + dur)} · {fmtShort(dur)} · src {fmtTime(clip.inMs)}–{fmtTime(clip.outMs)}
          </div>
        </div>
        {clip.reason && (
          <div className="flex items-start gap-1.5 rounded-md border border-accent/20 bg-accent/5 px-2 py-1.5 text-[11px] leading-relaxed text-fg/90">
            <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
            <span><span className="font-medium text-accent">Why this clip?</span> {clip.reason}</span>
          </div>
        )}
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => splitAtPlayhead()} title="Split at playhead (S)"><Scissors className="h-3 w-3" /> Split</Button>
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => duplicateSelection()}><Copy className="h-3 w-3" /> Duplicate</Button>
          <Button size="sm" variant="danger" onClick={() => deleteSelection()} title="Delete (⌫)"><Trash2 className="h-3 w-3" /></Button>
        </div>
      </Section>

      <Section title="Transform">
        <Field label="Scale" hint={`${Math.round(clip.transform.scale * 100)}%`}>
          <Slider min={0.5} max={3} step={0.01} value={clip.transform.scale} onChange={(v) => setTransform({ scale: v }, "scale")} />
        </Field>
        <div className="flex gap-1">
          {PUNCH_INS.map((p) => (
            <button key={p} type="button" onClick={() => applyOps([{ op: "setClipTransform", clipId: id, transform: { scale: p } }], `Punch in ${Math.round(p * 100)}%`)} className={cn("flex-1 rounded-md border px-1 py-1 text-[10px] font-medium", Math.abs(clip.transform.scale - p) < 0.005 ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-bg-2 text-muted hover:text-fg")}>
              {Math.round(p * 100)}%
            </button>
          ))}
        </div>
        <Field label="Position X" hint={`${Math.round(clip.transform.x)}px`}>
          <Slider min={-outW} max={outW} step={1} value={clip.transform.x} onChange={(v) => setTransform({ x: v }, "x")} />
        </Field>
        <Field label="Position Y" hint={`${Math.round(clip.transform.y)}px`}>
          <Slider min={-script.output.height} max={script.output.height} step={1} value={clip.transform.y} onChange={(v) => setTransform({ y: v }, "y")} />
        </Field>
        <Field label="Reframe">
          <div className="flex gap-1">
            {(
              [
                { k: "left", icon: AlignLeft, x: Math.round(outW * 0.2) },
                { k: "center", icon: AlignCenter, x: 0 },
                { k: "right", icon: AlignRight, x: -Math.round(outW * 0.2) },
              ] as const
            ).map((r) => (
              <button key={r.k} type="button" title={`Frame ${r.k}`} onClick={() => applyOps([{ op: "setClipTransform", clipId: id, transform: { x: r.x } }], `Reframe ${r.k}`)} className={cn("flex flex-1 items-center justify-center rounded-md border py-1.5", clip.transform.x === r.x ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-bg-2 text-muted hover:text-fg")}>
                <r.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Speed & volume">
        <Field label="Speed" hint={`${clip.speed}×`}>
          <div className="flex gap-1">
            {SPEEDS.map((sp) => (
              <button key={sp} type="button" onClick={() => applyOps([{ op: "setClipSpeed", clipId: id, speed: sp }], `Speed ${sp}×`)} className={cn("flex-1 rounded-md border px-1 py-1 text-[10px] font-medium", clip.speed === sp ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-bg-2 text-muted hover:text-fg")}>
                {sp}×
              </button>
            ))}
          </div>
        </Field>
        <Field label="Volume" hint={`${Math.round(clip.volume * 100)}%`}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => applyOps([{ op: "setClipVolume", clipId: id, volume: clip.volume > 0 ? 0 : 1 }], clip.volume > 0 ? "Mute clip" : "Unmute clip")} className="text-muted hover:text-fg">
              {clip.volume === 0 ? <VolumeX className="h-3.5 w-3.5 text-danger" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <Slider min={0} max={2} step={0.01} value={clip.volume} onChange={(v) => applyOps([{ op: "setClipVolume", clipId: id, volume: v }], "Volume", { coalesce: `${id}:vol` })} />
          </div>
        </Field>
      </Section>

      <Section title="Colour">
        <div className="grid grid-cols-4 gap-1.5">
          {COLOR_PRESET_INFO.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.description}
              onClick={() => applyOps(p.id === "none" ? [{ op: "removeEffect", clipId: id, effectType: "colorGrade" }] : [{ op: "addEffect", clipId: id, effect: { type: "colorGrade", params: { preset: p.id } } }], `Colour: ${p.name}`)}
              className={cn("flex flex-col items-center gap-1 rounded-md border p-1 text-[9px]", colorPreset === p.id ? "border-accent/60 bg-accent/10 text-accent" : "border-border bg-bg-2 text-muted hover:text-fg")}
            >
              <ColorSwatch preset={p.id} className="h-6 w-full rounded" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Effects">
        <div className="flex flex-col gap-1.5">
          {EFFECTS.filter((e) => e.id !== "colorGrade" && e.id !== "speedRamp").map((e) => {
            const active = clip.effects.find((x) => x.type === e.id);
            const param = EFFECT_PARAM[e.id];
            const value = active && param ? Number(active.params[param.key] ?? param.default) : param?.default ?? 0;
            return (
              <div key={e.id} className={cn("rounded-md border px-2 py-1.5", active ? "border-accent/40 bg-accent/5" : "border-border bg-bg-2")}>
                <label className="flex cursor-pointer items-center justify-between gap-2 text-xs">
                  <span className={active ? "text-fg" : "text-muted"} title={e.description}>{e.name}</span>
                  <Toggle checked={!!active} onChange={(on) => applyOps(on ? [{ op: "addEffect", clipId: id, effect: { type: e.id, params: param ? { [param.key]: param.default } : {} } }] : [{ op: "removeEffect", clipId: id, effectType: e.id }], `${on ? "Add" : "Remove"} ${e.name}`)} />
                </label>
                {active && param && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="w-14 text-[10px] text-muted">{param.label}</span>
                    <Slider min={param.min} max={param.max} step={param.step} value={value} onChange={(v) => applyOps([{ op: "addEffect", clipId: id, effect: { type: e.id, params: { ...active.params, [param.key]: v } } }], e.name, { coalesce: `${id}:${e.id}` })} />
                    <span className="w-8 text-right font-mono text-[10px] text-muted">{param.step < 1 ? value.toFixed(2) : value}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Transitions">
        {(["in", "out"] as const).map((side) => {
          const t = side === "in" ? clip.transitionIn : clip.transitionOut;
          return (
            <Field key={side} label={side === "in" ? "Transition in" : "Transition out"} hint={t && t.type !== "cut" ? `${t.durationMs}ms` : undefined}>
              <div className="flex gap-1.5">
                <select
                  value={t?.type ?? "cut"}
                  onChange={(e) => {
                    const type = e.target.value as TransitionType;
                    const info = TRANSITIONS.find((x) => x.id === type)!;
                    applyOps([{ op: "setTransition", clipId: id, side, transition: type === "cut" ? null : { type, durationMs: info.defaultMs } }], `Transition ${side}: ${info.name}`);
                  }}
                  className="h-8 flex-1 rounded-md border border-border bg-bg-2 px-2 text-xs"
                >
                  {TRANSITIONS.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
                {t && t.type !== "cut" && (
                  <input type="number" min={50} max={2000} step={50} value={t.durationMs} onChange={(e) => applyOps([{ op: "setTransition", clipId: id, side, transition: { type: t.type, durationMs: Number(e.target.value) } }], "Transition length", { coalesce: `${id}:tr${side}` })} className="h-8 w-20 rounded-md border border-border bg-bg-2 px-2 font-mono text-xs" />
                )}
              </div>
            </Field>
          );
        })}
      </Section>
    </div>
  );
}

export function AudioClipInspector() {
  const sel = useSelectedAudio();
  const script = useEditor((s) => s.script);
  const applyOps = useEditor((s) => s.applyOps);
  if (!sel || !script) return null;
  const { clip, track } = sel;
  const asset = script.assets[clip.assetId];
  const len = audioClipLength(clip, script);
  const patch = (p: Partial<typeof clip>, label: string, coalesce?: string) => applyOps([{ op: "updateAudioClip", clipId: clip.id, patch: p }], label, coalesce ? { coalesce: `${clip.id}:${coalesce}` } : undefined);
  return (
    <div className="flex flex-col">
      <Section title={`${track.role} clip`} right={track.muted ? <span className="text-[10px] text-danger">track muted</span> : null}>
        <div>
          <div className="truncate text-sm font-medium">{clip.label ?? asset?.name ?? clip.assetId}</div>
          <div className="mt-0.5 font-mono text-[10px] text-muted">{fmtTime(clip.startMs)} → {fmtTime(clip.startMs + len)} · {fmtShort(len)}</div>
        </div>
        {clip.reason && <div className="rounded-md border border-accent/20 bg-accent/5 px-2 py-1.5 text-[11px] leading-relaxed">{clip.reason}</div>}
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => duplicateSelection()}><Copy className="h-3 w-3" /> Duplicate</Button>
          <Button size="sm" variant="danger" onClick={() => deleteSelection()}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </Section>
      <Section title="Mix">
        <Field label="Gain" hint={fmtDb(clip.gainDb)}>
          <Slider min={-40} max={12} step={1} value={clip.gainDb} onChange={(v) => patch({ gainDb: v }, "Gain", "gain")} />
        </Field>
        <label className="flex items-center justify-between text-xs">
          <span>Duck under speech</span>
          <Toggle checked={clip.ducking} onChange={(on) => patch({ ducking: on }, on ? "Ducking on" : "Ducking off")} />
        </label>
        <label className="flex items-center justify-between text-xs">
          <span>Loop</span>
          <Toggle checked={clip.loop} onChange={(on) => patch({ loop: on }, on ? "Loop on" : "Loop off")} />
        </label>
        <Field label="Fade in" hint={fmtShort(clip.fadeInMs)}>
          <Slider min={0} max={5000} step={100} value={clip.fadeInMs} onChange={(v) => patch({ fadeInMs: v }, "Fade in", "fin")} />
        </Field>
        <Field label="Fade out" hint={fmtShort(clip.fadeOutMs)}>
          <Slider min={0} max={5000} step={100} value={clip.fadeOutMs} onChange={(v) => patch({ fadeOutMs: v }, "Fade out", "fout")} />
        </Field>
      </Section>
    </div>
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-4 w-7 shrink-0 rounded-full border transition-colors disabled:opacity-40", checked ? "border-accent bg-accent" : "border-border bg-bg-3")}
    >
      <span className={cn("absolute top-0.5 h-[10px] w-[10px] rounded-full transition-all", checked ? "left-[14px] bg-black" : "left-0.5 bg-muted")} />
    </button>
  );
}

const SWATCH: Record<ColorPreset, string> = {
  none: "linear-gradient(135deg,#8a8f98,#2d3038)",
  "warm-film": "linear-gradient(135deg,#f0b27a,#6b3a2a)",
  clean: "linear-gradient(135deg,#f5f7fa,#9aa3ad)",
  moody: "linear-gradient(135deg,#3b4a5a,#0b0f14)",
  vibrant: "linear-gradient(135deg,#ff4d6d,#ffd400,#2dd4bf)",
  bw: "linear-gradient(135deg,#ffffff,#000000)",
  "teal-orange": "linear-gradient(135deg,#ff9f43,#0fb9b1)",
};

export function ColorSwatch({ preset, className }: { preset: ColorPreset; className?: string }) {
  return <span className={cn("block", className)} style={{ background: SWATCH[preset] }} />;
}
