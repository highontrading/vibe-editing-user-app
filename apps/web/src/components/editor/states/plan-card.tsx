"use client";
import * as React from "react";
import { Zap, Scissors, Gauge, Captions, Music, Volume2, Shapes, Film, Palette, Crop, Timer, Sparkles, Check, Pencil } from "lucide-react";
import type { Plan, PlanStep } from "@vibe/edl";
import { PLATFORM_PRESETS, CAPTION_STYLES, type Platform } from "@vibe/edl";
import { cn } from "@/lib/utils";
import { fmtShort } from "@/lib/editor/format";

export const STEP_ICONS: Record<PlanStep["kind"], React.ComponentType<{ className?: string }>> = {
  hook: Zap,
  cuts: Scissors,
  pacing: Gauge,
  captions: Captions,
  music: Music,
  sfx: Volume2,
  graphics: Shapes,
  broll: Film,
  color: Palette,
  reframe: Crop,
  length: Timer,
  other: Sparkles,
};

export function PlanCard({ plan, onChange, compact, className }: { plan: Plan; onChange?: (plan: Plan) => void; compact?: boolean; className?: string }) {
  const editable = !!onChange;
  const toggle = (id: string) => onChange?.({ ...plan, steps: plan.steps.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)) });
  const setText = (id: string, text: string) => onChange?.({ ...plan, steps: plan.steps.map((s) => (s.id === id ? { ...s, text } : s)) });
  const platform = PLATFORM_PRESETS[plan.platform as Platform]?.label ?? plan.platform;
  const caption = CAPTION_STYLES.find((c) => c.id === plan.captionStyle)?.name ?? plan.captionStyle;
  return (
    <div className={cn("rounded-xl border border-border bg-bg-2", className)}>
      <div className={cn("border-b border-border", compact ? "px-3 py-2.5" : "px-4 py-3.5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">The plan</div>
            <h3 className={cn("mt-0.5 font-display leading-tight", compact ? "text-base" : "text-xl")}>{plan.title}</h3>
          </div>
        </div>
        <p className={cn("mt-1.5 text-muted", compact ? "text-xs" : "text-sm")}>{plan.summary}</p>
        <div className="mt-2.5 flex flex-wrap gap-1">
          <Tag>{plan.aspect}</Tag>
          <Tag>{platform}</Tag>
          {plan.targetDurationMs ? <Tag>~{fmtShort(plan.targetDurationMs)}</Tag> : null}
          <Tag>{caption} captions</Tag>
          {plan.musicMood && <Tag>{plan.musicMood} music</Tag>}
          {plan.colorPreset !== "none" && <Tag>{plan.colorPreset}</Tag>}
        </div>
      </div>
      <ul className={cn("flex flex-col", compact ? "p-1.5" : "p-2")}>
        {plan.steps.map((step) => (
          <StepRow key={step.id} step={step} editable={editable} compact={compact} onToggle={() => toggle(step.id)} onText={(t) => setText(step.id, t)} />
        ))}
      </ul>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-border bg-bg-3 px-1.5 py-0.5 text-[10px] font-medium text-muted">{children}</span>;
}

function StepRow({ step, editable, compact, onToggle, onText }: { step: PlanStep; editable: boolean; compact?: boolean; onToggle: () => void; onText: (t: string) => void }) {
  const Icon = STEP_ICONS[step.kind] ?? Sparkles;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(step.text);
  React.useEffect(() => setDraft(step.text), [step.text]);
  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== step.text) onText(draft.trim());
    else setDraft(step.text);
  };
  return (
    <li className={cn("group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors", editable && "hover:bg-white/4", !step.enabled && "opacity-50")}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!editable}
        aria-pressed={step.enabled}
        title={step.enabled ? "Turn this step off" : "Turn this step on"}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          step.enabled ? "border-accent bg-accent text-black" : "border-border bg-bg-3 text-transparent",
          !editable && "cursor-default",
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", step.enabled ? "text-accent" : "text-muted")} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(step.text);
                setEditing(false);
              }
            }}
            rows={2}
            className="w-full resize-none rounded-md border border-accent/40 bg-bg px-2 py-1 text-xs leading-relaxed text-fg outline-none"
          />
        ) : (
          <p className={cn("leading-relaxed", compact ? "text-xs" : "text-[13px]", !step.enabled && "line-through decoration-muted/50")} onDoubleClick={() => editable && setEditing(true)}>
            {step.text}
          </p>
        )}
      </div>
      {editable && !editing && (
        <button type="button" onClick={() => setEditing(true)} className="mt-0.5 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100" title="Edit this step">
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}
