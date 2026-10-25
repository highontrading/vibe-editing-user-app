"use client";
/** Edit commands shared by keyboard shortcuts, the timeline and the inspector. */
import { clipDuration, getTrack, mainClips, newId, type EditOp, type EditScript, type VideoClip } from "@vibe/edl";
import { toast } from "@/components/ui/toast";
import { useEditor, type Selection } from "./store";

export function findClip(script: EditScript, clipId: string): { clip: VideoClip; trackId: string; layer: number } | null {
  for (const t of script.tracks) {
    if (t.kind !== "video") continue;
    const clip = t.clips.find((c) => c.id === clipId);
    if (clip) return { clip, trackId: t.id, layer: t.layer };
  }
  return null;
}

/** Main-track clip under a timeline position. */
export function clipAt(script: EditScript, ms: number): VideoClip | null {
  for (const c of mainClips(script)) {
    const end = c.startMs + clipDuration(c);
    if (ms > c.startMs && ms < end) return c;
  }
  return null;
}

export function splitAtPlayhead(): boolean {
  const { script, selection, playheadMs, applyOps, select } = useEditor.getState();
  if (!script) return false;
  let target: VideoClip | null = null;
  if (selection?.kind === "clip") {
    const found = findClip(script, selection.id);
    if (found) {
      const end = found.clip.startMs + clipDuration(found.clip);
      if (playheadMs > found.clip.startMs && playheadMs < end) target = found.clip;
    }
  }
  if (!target) target = clipAt(script, playheadMs);
  if (!target) {
    toast.info("Nothing to split here", "Move the playhead inside a clip.");
    return false;
  }
  const ok = applyOps([{ op: "splitClip", clipId: target.id, atMs: Math.round(playheadMs) }], "Split clip");
  if (ok) {
    // select the right-hand half (it starts at the playhead)
    const next = useEditor.getState().script;
    const found = next && findClip(next, target.id);
    if (found) {
      const track = next!.tracks.find((t) => t.id === found.trackId);
      if (track?.kind === "video") {
        const right = track.clips.find((c) => c.startMs === Math.round(playheadMs) && c.id !== target!.id);
        if (right) select({ kind: "clip", id: right.id, trackId: track.id });
      }
    }
  }
  return ok;
}

export function deleteSelection(): boolean {
  const { script, selection, applyOps, select } = useEditor.getState();
  if (!script || !selection) return false;
  let ok = false;
  switch (selection.kind) {
    case "clip":
      ok = applyOps([{ op: "deleteClip", clipId: selection.id }], "Delete clip");
      break;
    case "audio":
      ok = applyOps([{ op: "deleteAudioClip", clipId: selection.id }], "Delete audio");
      break;
    case "graphic":
      ok = applyOps([{ op: "deleteGraphic", itemId: selection.id }], "Delete graphic");
      break;
    case "captions":
      ok = applyOps([{ op: "setCaptionsEnabled", enabled: false }], "Captions off");
      break;
  }
  if (ok && selection.kind !== "captions") select(null);
  return ok;
}

export function duplicateSelection(): boolean {
  const { script, selection, applyOps, select } = useEditor.getState();
  if (!script || !selection) return false;
  if (selection.kind === "clip") {
    const found = findClip(script, selection.id);
    if (!found) return false;
    const id = newId("clip");
    const dur = clipDuration(found.clip);
    const ok = applyOps(
      [{ op: "addVideoClip", trackId: found.trackId, clip: { ...found.clip, id, startMs: found.clip.startMs + dur, transitionIn: undefined } }],
      "Duplicate clip",
    );
    if (ok) select({ kind: "clip", id, trackId: found.trackId });
    return ok;
  }
  if (selection.kind === "graphic") {
    const gfx = getTrack(script, "graphics");
    const item = gfx?.items.find((g) => g.id === selection.id);
    if (!item) return false;
    const id = newId("gfx");
    const ok = applyOps([{ op: "addGraphic", item: { ...item, id, startMs: item.startMs + item.durationMs } }], "Duplicate graphic");
    if (ok) select({ kind: "graphic", id });
    return ok;
  }
  if (selection.kind === "audio") {
    for (const t of script.tracks) {
      if (t.kind !== "audio") continue;
      const clip = t.clips.find((c) => c.id === selection.id);
      if (clip) {
        const id = newId("audio");
        const len = clip.outMs !== undefined ? clip.outMs - clip.inMs : (script.assets[clip.assetId]?.durationMs ?? 2000) - clip.inMs;
        const ok = applyOps([{ op: "addAudioClip", role: t.role, clip: { ...clip, id, startMs: clip.startMs + Math.max(0, len) } }], "Duplicate audio");
        if (ok) select({ kind: "audio", id, trackId: t.id });
        return ok;
      }
    }
  }
  return false;
}

/** I / O: set the selected clip's in or out point at the playhead. */
export function setInOutAtPlayhead(side: "in" | "out"): boolean {
  const { script, selection, playheadMs, applyOps } = useEditor.getState();
  if (!script || selection?.kind !== "clip") {
    toast.info(`Select a clip to set its ${side} point`);
    return false;
  }
  const found = findClip(script, selection.id);
  if (!found) return false;
  const { clip } = found;
  const dur = clipDuration(clip);
  const rel = playheadMs - clip.startMs;
  if (rel <= 0 || rel >= dur) {
    toast.info("Playhead is outside the selected clip");
    return false;
  }
  const sourceAt = clip.inMs + Math.round(rel * (clip.speed || 1));
  return side === "in" ? applyOps([{ op: "trimClip", clipId: clip.id, inMs: sourceAt }], "Set in point") : applyOps([{ op: "trimClip", clipId: clip.id, outMs: sourceAt }], "Set out point");
}

export function toggleMuteSelection(): boolean {
  const { script, selection, applyOps } = useEditor.getState();
  if (!script || !selection) return false;
  if (selection.kind === "clip") {
    const found = findClip(script, selection.id);
    if (!found) return false;
    return applyOps([{ op: "setClipVolume", clipId: selection.id, volume: found.clip.volume > 0 ? 0 : 1 }], found.clip.volume > 0 ? "Mute clip" : "Unmute clip");
  }
  if (selection.kind === "audio") {
    const track = script.tracks.find((t) => t.id === selection.trackId);
    if (!track || track.kind !== "audio") return false;
    return applyOps([{ op: "setTrackMuted", trackId: track.id, muted: !track.muted }], track.muted ? "Unmute track" : "Mute track");
  }
  return false;
}

export function selectionLabel(script: EditScript, sel: Selection): string {
  switch (sel.kind) {
    case "clip": {
      const f = findClip(script, sel.id);
      return f?.clip.label ?? script.assets[f?.clip.assetId ?? ""]?.name ?? "Clip";
    }
    case "audio": {
      for (const t of script.tracks) if (t.kind === "audio") for (const c of t.clips) if (c.id === sel.id) return c.label ?? script.assets[c.assetId]?.name ?? t.role;
      return "Audio";
    }
    case "graphic": {
      const g = getTrack(script, "graphics")?.items.find((i) => i.id === sel.id);
      return g?.component ?? "Graphic";
    }
    case "captions":
      return "Captions";
  }
}

export const opsFor = (ops: EditOp[]) => ops;
