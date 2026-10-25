"use client";
import * as React from "react";
import { Plus, Trash2, Copy, Type, Shapes, HelpCircle } from "lucide-react";
import { COMPONENT_CATALOG, newId, type ComponentInfo, type GraphicItem } from "@vibe/edl";
import { cn } from "@/lib/utils";
import { fmtShort, fmtTime } from "@/lib/editor/format";
import { useEditor, useSelectedGraphic } from "@/lib/editor/store";
import { deleteSelection, duplicateSelection } from "@/lib/editor/commands";
import { Button } from "@/components/ui/button";
import { Field, Section, Slider } from "../panel";
import { Toggle } from "./clip-inspector";

function defaultProps(info: ComponentInfo): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(info.props)) {
    if (v.default !== undefined) out[k] = v.default;
    else if (v.type === "string") out[k] = k === "text" || k === "name" || k === "headline" || k === "title" ? info.name : "";
  }
  return out;
}

export function GraphicsInspector() {
  const script = useEditor((s) => s.script);
  const applyOps = useEditor((s) => s.applyOps);
  const select = useEditor((s) => s.select);
  if (!script) return null;
  const gfx = script.tracks.find((t) => t.kind === "graphics");
  const add = (info: ComponentInfo) => {
    const st = useEditor.getState();
    const id = newId("gfx");
    const startMs = info.defaultDurationMs === 0 ? 0 : Math.round(st.playheadMs);
    const ok = applyOps([{ op: "addGraphic", item: { id, component: info.id, startMs, durationMs: info.defaultDurationMs, props: defaultProps(info) } }], `Add ${info.name}`);
    if (ok) select({ kind: "graphic", id });
  };
  return (
    <div className="flex flex-col">
      <Section title="Add at playhead">
        <div className="grid grid-cols-2 gap-1.5">
          {COMPONENT_CATALOG.map((c) => (
            <button key={c.id} type="button" title={c.description} onClick={() => add(c)} className="group flex flex-col gap-1 rounded-lg border border-border bg-bg-2 p-2 text-left transition-colors hover:border-accent/50">
              <div className="flex items-center justify-between">
                <Shapes className="h-3.5 w-3.5 text-accent" />
                <Plus className="h-3 w-3 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <span className="text-xs font-medium">{c.name}</span>
              <span className="line-clamp-2 text-[10px] leading-snug text-muted">{c.description}</span>
              <span className="font-mono text-[9px] text-muted">{c.defaultDurationMs ? fmtShort(c.defaultDurationMs) : "whole video"}</span>
            </button>
          ))}
        </div>
      </Section>
      {gfx && gfx.items.length > 0 && (
        <Section title={`On the timeline · ${gfx.items.length}`}>
          <div className="flex flex-col gap-1">
            {[...gfx.items].sort((a, b) => a.startMs - b.startMs).map((g) => (
              <button key={g.id} type="button" onClick={() => select({ kind: "graphic", id: g.id })} className="flex items-center justify-between rounded-md border border-border bg-bg-2 px-2 py-1.5 text-left text-xs hover:border-white/25">
                <span className="truncate"><span className="font-medium">{g.component}</span>{g.props.text || g.props.name ? <span className="text-muted"> · {String(g.props.text ?? g.props.name)}</span> : null}</span>
                <span className="font-mono text-[10px] text-muted">{fmtTime(g.startMs)}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function GraphicItemInspector() {
  const sel = useSelectedGraphic();
  const script = useEditor((s) => s.script);
  const applyOps = useEditor((s) => s.applyOps);
  if (!sel || !script) return null;
  const { item } = sel;
  const info = COMPONENT_CATALOG.find((c) => c.id === item.component);
  const patch = (p: Partial<GraphicItem>, label: string, coalesce?: string) => applyOps([{ op: "updateGraphic", itemId: item.id, patch: p }], label, coalesce ? { coalesce: `${item.id}:${coalesce}` } : undefined);
  const setProp = (k: string, v: unknown, coalesce?: string) => patch({ props: { [k]: v } }, `${info?.name ?? item.component}: ${k}`, coalesce ? k : undefined);
  return (
    <div className="flex flex-col">
      <Section title="Graphic">
        <div>
          <div className="text-sm font-medium">{info?.name ?? item.component}</div>
          {info && <div className="mt-0.5 text-[11px] leading-snug text-muted">{info.description}</div>}
        </div>
        {item.reason && (
          <div className="flex items-start gap-1.5 rounded-md border border-accent/20 bg-accent/5 px-2 py-1.5 text-[11px] leading-relaxed"><HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-accent" />{item.reason}</div>
        )}
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => duplicateSelection()}><Copy className="h-3 w-3" /> Duplicate</Button>
          <Button size="sm" variant="danger" onClick={() => deleteSelection()}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </Section>
      <Section title="Timing">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start" hint={fmtTime(item.startMs)}>
            <input type="number" min={0} step={100} value={item.startMs} onChange={(e) => patch({ startMs: Math.max(0, Number(e.target.value)) }, "Graphic start", "start")} className="h-8 rounded-md border border-border bg-bg-2 px-2 font-mono text-xs" />
          </Field>
          <Field label="Duration" hint={item.durationMs ? fmtShort(item.durationMs) : "whole video"}>
            <input type="number" min={0} step={100} value={item.durationMs} onChange={(e) => patch({ durationMs: Math.max(0, Number(e.target.value)) }, "Graphic length", "dur")} className="h-8 rounded-md border border-border bg-bg-2 px-2 font-mono text-xs" />
          </Field>
        </div>
        <Button size="sm" variant="ghost" onClick={() => patch({ startMs: Math.round(useEditor.getState().playheadMs) }, "Move graphic to playhead")}>Move to playhead</Button>
      </Section>
      {info && (
        <Section title="Properties">
          {Object.entries(info.props).map(([k, p]) => {
            const value = item.props[k] ?? p.default;
            switch (p.type) {
              case "string":
                return (
                  <Field key={k} label={k} hint={p.description}>
                    <div className="relative">
                      <Type className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
                      <input value={String(value ?? "")} onChange={(e) => setProp(k, e.target.value, k)} className="h-8 w-full rounded-md border border-border bg-bg-2 pl-7 pr-2 text-xs" />
                    </div>
                  </Field>
                );
              case "number": {
                const isUnit = /0-1/.test(p.description);
                const num = Number(value ?? 0);
                return (
                  <Field key={k} label={k} hint={isUnit ? num.toFixed(2) : String(num)}>
                    {isUnit ? <Slider min={0} max={1} step={0.01} value={num} onChange={(v) => setProp(k, v, k)} /> : <input type="number" value={num} onChange={(e) => setProp(k, Number(e.target.value), k)} className="h-8 rounded-md border border-border bg-bg-2 px-2 font-mono text-xs" />}
                  </Field>
                );
              }
              case "boolean":
                return (
                  <label key={k} className="flex items-center justify-between rounded-md border border-border bg-bg-2 px-2 py-1.5 text-xs"><span>{k}<span className="block text-[10px] text-muted">{p.description}</span></span><Toggle checked={!!value} onChange={(on) => setProp(k, on)} /></label>
                );
              case "color":
                return (
                  <label key={k} className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-2 px-2 py-1.5 text-xs">
                    <span>{k}</span>
                    <span className="flex items-center gap-1.5"><span className="font-mono text-[10px] text-muted">{String(value ?? "").toUpperCase()}</span><input type="color" value={String(value ?? "#ffffff")} onChange={(e) => setProp(k, e.target.value, k)} className="h-5 w-6 cursor-pointer rounded border border-border bg-transparent p-0" /></span>
                  </label>
                );
              case "enum":
                return (
                  <Field key={k} label={k} hint={p.description}>
                    <div className="flex flex-wrap gap-1">
                      {(p.options ?? []).map((o) => (
                        <button key={o} type="button" onClick={() => setProp(k, o)} className={cn("rounded-md border px-2 py-1 text-[10px] font-medium", value === o ? "border-accent/60 bg-accent/15 text-accent" : "border-border bg-bg-2 text-muted hover:text-fg")}>{o}</button>
                      ))}
                    </div>
                  </Field>
                );
            }
          })}
        </Section>
      )}
    </div>
  );
}
