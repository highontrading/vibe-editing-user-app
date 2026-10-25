"use client";
import * as React from "react";
import { MousePointer2, Captions, Music, Shapes, Globe, History, ShieldCheck, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditor, type InspectorTab } from "@/lib/editor/store";
import { IconButton } from "../panel";
import { ClipInspector, AudioClipInspector } from "./clip-inspector";
import { CaptionsInspector } from "./captions-inspector";
import { MusicInspector } from "./music-inspector";
import { GraphicsInspector, GraphicItemInspector } from "./graphics-inspector";
import { GlobalInspector } from "./global-inspector";
import { VersionsPanel } from "./versions-panel";
import { ChecksPanel, useChecks } from "./checks-panel";

const TABS: { id: InspectorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "selection", label: "Selection", icon: MousePointer2 },
  { id: "captions", label: "Captions", icon: Captions },
  { id: "music", label: "Music", icon: Music },
  { id: "graphics", label: "Graphics", icon: Shapes },
  { id: "global", label: "Look", icon: Globe },
  { id: "versions", label: "Versions", icon: History },
  { id: "checks", label: "Checks", icon: ShieldCheck },
];

export function Inspector() {
  const tab = useEditor((s) => s.inspectorTab);
  const set = useEditor((s) => s.set);
  const selection = useEditor((s) => s.selection);
  const checks = useChecks();
  const failing = checks.filter((c) => !c.ok).length;
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border px-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={t.label}
            onClick={() => set({ inspectorTab: t.id })}
            className={cn("relative flex h-7 flex-1 items-center justify-center rounded-md text-muted transition-colors hover:bg-white/6 hover:text-fg", tab === t.id && "bg-white/10 text-fg")}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.id === "selection" && selection && tab !== "selection" && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />}
            {t.id === "checks" && failing > 0 && <span className="absolute right-0.5 top-0.5 rounded-full bg-danger px-1 text-[8px] font-bold leading-[12px] text-white">{failing}</span>}
          </button>
        ))}
        <IconButton title="Collapse inspector (])" onClick={() => set({ inspectorOpen: false })}>
          <PanelRightClose className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "selection" && <SelectionTab />}
        {tab === "captions" && <CaptionsInspector />}
        {tab === "music" && <MusicInspector />}
        {tab === "graphics" && <GraphicsInspector />}
        {tab === "global" && <GlobalInspector />}
        {tab === "versions" && <VersionsPanel />}
        {tab === "checks" && <ChecksPanel />}
      </div>
    </div>
  );
}

function SelectionTab() {
  const selection = useEditor((s) => s.selection);
  const set = useEditor((s) => s.set);
  if (!selection) {
    return (
      <div className="flex flex-col gap-3 p-4 text-xs text-muted">
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <MousePointer2 className="mx-auto mb-2 h-5 w-5 opacity-60" />
          Select a clip, caption word, music or graphic on the timeline to edit it here.
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TABS.slice(1, 5).map((t) => (
            <button key={t.id} type="button" onClick={() => set({ inspectorTab: t.id })} className="flex items-center gap-2 rounded-lg border border-border bg-bg-2 px-3 py-2 text-left text-xs text-fg hover:border-white/20">
              <t.icon className="h-3.5 w-3.5 text-accent" /> {t.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  switch (selection.kind) {
    case "clip":
      return <ClipInspector />;
    case "audio":
      return <AudioClipInspector />;
    case "graphic":
      return <GraphicItemInspector />;
    case "captions":
      return <CaptionsInspector />;
  }
}
