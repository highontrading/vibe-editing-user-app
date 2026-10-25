"use client";
import * as React from "react";
import { ShieldCheck, Check, X, Wrench } from "lucide-react";
import { PLATFORM_PRESETS, getTrack, mainClips, runChecks, type CheckResult, type EditOp, type EditScript, type Platform } from "@vibe/edl";
import { cn } from "@/lib/utils";
import { useEditor } from "@/lib/editor/store";
import { toast } from "@/components/ui/toast";

export function useChecks(): CheckResult[] {
  const script = useEditor((s) => s.script);
  const platform = useEditor((s) => s.project?.platform);
  const target = useEditor((s) => s.project?.targetDurationMs);
  return React.useMemo(() => (script ? runChecks(script, { platform: (script.meta.platform ?? platform) as Platform | undefined, targetDurationMs: target ?? undefined }) : []), [script, platform, target]);
}

/** Deterministic fixes for fixable checks, expressed as ops. */
export function fixOps(script: EditScript, check: CheckResult, opts: { platform?: Platform; targetDurationMs?: number }): { ops: EditOp[]; label: string } | null {
  const clips = mainClips(script);
  switch (check.id) {
    case "no-gaps": {
      const first = [...clips].sort((a, b) => a.startMs - b.startMs)[0];
      if (!first) return null;
      // moveClip on the main track re-packs (ripples) every clip
      return { ops: [{ op: "moveClip", clipId: first.id, startMs: 0 }], label: "Close gaps" };
    }
    case "caption-safe":
      return { ops: [{ op: "setCaptionSettings", settings: { position: "center" } }], label: "Captions to centre" };
    case "music-level": {
      const music = getTrack(script, "audio", (t) => t.role === "music");
      const loud = music?.clips.filter((c) => c.gainDb > -6) ?? [];
      if (!loud.length) return null;
      return { ops: loud.map((c) => ({ op: "updateAudioClip" as const, clipId: c.id, patch: { gainDb: -18, ducking: true } })), label: "Music under speech" };
    }
    case "platform-max": {
      const preset = PLATFORM_PRESETS[opts.platform ?? "custom"];
      if (script.output.durationMs <= preset.maxDurationMs) return null;
      return { ops: [{ op: "removeRange", startMs: preset.maxDurationMs, endMs: script.output.durationMs }], label: `Trim to ${preset.label} maximum` };
    }
    case "length": {
      const target = opts.targetDurationMs;
      if (!target || script.output.durationMs <= target * 1.25) return null;
      return { ops: [{ op: "removeRange", startMs: target, endMs: script.output.durationMs }], label: "Trim to target length" };
    }
  }
  return null;
}

export function ChecksPanel() {
  const checks = useChecks();
  const script = useEditor((s) => s.script);
  const project = useEditor((s) => s.project);
  const applyOps = useEditor((s) => s.applyOps);
  if (!script) return null;
  const failing = checks.filter((c) => !c.ok).length;
  const platform = (script.meta.platform ?? project?.platform) as Platform | undefined;
  const fix = (c: CheckResult) => {
    const f = fixOps(script, c, { platform, targetDurationMs: project?.targetDurationMs ?? undefined });
    if (!f) return toast.info("Nothing to fix automatically", "Ask the editor in chat for a smarter fix.");
    if (applyOps(f.ops, f.label)) toast.success(f.label);
  };
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", failing ? "border-danger/30 bg-danger/5" : "border-success/30 bg-success/5")}>
        <ShieldCheck className={cn("h-4 w-4", failing ? "text-danger" : "text-success")} />
        <span className="font-medium">{failing ? `${failing} check${failing === 1 ? "" : "s"} need attention` : "All checks pass"}</span>
        <span className="ml-auto font-mono text-[10px] text-muted">{checks.length - failing}/{checks.length}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {checks.map((c) => (
          <li key={c.id} className={cn("flex items-start gap-2 rounded-md border px-2.5 py-2", c.ok ? "border-border bg-bg-2" : "border-danger/30 bg-danger/5")}>
            {c.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />}
            <div className="min-w-0 flex-1">
              <div className="text-xs">{c.label}</div>
              {c.detail && <div className="text-[10px] text-muted">{c.detail}</div>}
            </div>
            {!c.ok && c.fixable && (
              <button type="button" onClick={() => fix(c)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-bg-3 px-2 py-1 text-[10px] font-medium hover:border-accent/50 hover:text-accent">
                <Wrench className="h-3 w-3" /> Fix
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[10px] leading-relaxed text-muted">Checks run live on every edit: safe zones, length, gaps, audio levels and aspect ratio for {platform ? PLATFORM_PRESETS[platform].label : "your platform"}.</p>
    </div>
  );
}
