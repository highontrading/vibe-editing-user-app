/** Self-check: run the deterministic edl checks and auto-fix the fixable ones with ops. */
import { getTrack, mainClips, PLATFORM_PRESETS, runChecks, type CheckResult, type EditOp, type EditScript, type Platform, PLATFORMS } from "@vibe/edl";
import type { ProjectContext } from "./types";
import { OpRecorder, normalizeEnds, trimScriptToTarget } from "./builder";

export interface SelfCheckResult {
  checks: CheckResult[];
  script: EditScript;
  /** ops applied while fixing */
  ops: EditOp[];
  fixed: string[];
}

export function selfCheckSync(script: EditScript, ctx?: Pick<ProjectContext, "platform" | "targetDurationMs"> | null): SelfCheckResult {
  const platform = ((ctx?.platform && (PLATFORMS as readonly string[]).includes(ctx.platform) ? ctx.platform : script.meta.platform) ?? "custom") as Platform;
  const targetDurationMs = ctx?.targetDurationMs ?? undefined;
  const rec = new OpRecorder(script);
  const fixed: string[] = [];
  let checks = runChecks(rec.script, { platform, targetDurationMs });
  const failing = checks.filter((c) => !c.ok && c.fixable);
  for (const c of failing) {
    try {
      switch (c.id) {
        case "no-gaps": {
          const first = mainClips(rec.script)[0];
          // moveClip re-packs (ripples) the main track; there is no dedicated ripple op.
          if (first) rec.apply({ op: "moveClip", clipId: first.id, startMs: 0 });
          fixed.push("closed gaps between clips");
          break;
        }
        case "caption-safe": {
          rec.apply({ op: "setCaptionSettings", settings: { position: "center" } });
          fixed.push("moved captions into the safe zone");
          break;
        }
        case "music-level": {
          const music = getTrack(rec.script, "audio", (t) => t.role === "music");
          for (const clip of music?.clips ?? []) if (clip.gainDb > -12) rec.apply({ op: "updateAudioClip", clipId: clip.id, patch: { gainDb: -12, ducking: true } });
          fixed.push("lowered music under speech");
          break;
        }
        case "platform-max": {
          const max = PLATFORM_PRESETS[platform].maxDurationMs;
          if (rec.script.output.durationMs > max) {
            trimScriptToTarget(rec, max);
            if (rec.script.output.durationMs > max) rec.apply({ op: "removeRange", startMs: max, endMs: rec.script.output.durationMs });
            normalizeEnds(rec);
            fixed.push(`trimmed to the ${PLATFORM_PRESETS[platform].label} maximum`);
          }
          break;
        }
        case "length": {
          if (targetDurationMs && rec.script.output.durationMs > targetDurationMs * 1.25) {
            trimScriptToTarget(rec, targetDurationMs);
            fixed.push("trimmed closer to the target length");
          }
          break;
        }
      }
    } catch {
      // never let a fix break the script; the check stays red
    }
  }
  if (fixed.length) checks = runChecks(rec.script, { platform, targetDurationMs });
  return { checks, script: rec.script, ops: rec.ops, fixed };
}
