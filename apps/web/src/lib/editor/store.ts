"use client";
/**
 * Editor state. The script is edited locally through @vibe/edl applyOps for an
 * instant preview; batches of ops are persisted (debounced 800ms) with
 * POST /api/projects/[id]/ops, which creates one USER ScriptVersion per batch.
 * Undo/redo is a client stack of scripts; each undo/redo persists a new version
 * via a `replaceScript` op so the version history always matches the preview.
 */
import * as React from "react";
import { create } from "zustand";
import { applyOps as applyOpsEdl, OpError, type EditOp, type EditScript } from "@vibe/edl";
import { api } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { ExportView, MessageView, OpsResponse, ProjectView, VersionView, VersionWithScript } from "./types";

export type Selection =
  | { kind: "clip"; id: string; trackId: string }
  | { kind: "audio"; id: string; trackId: string }
  | { kind: "graphic"; id: string }
  | { kind: "captions"; id: "captions" };

export type InspectorTab = "selection" | "captions" | "music" | "graphics" | "global" | "versions" | "checks";

const FLUSH_MS = 800;

interface PendingBatch {
  ops: EditOp[];
  labels: string[];
}

export interface EditorState {
  projectId: string;
  project: ProjectView | null;
  script: EditScript | null;
  currentVersionId: string | null;
  versions: VersionView[];
  messages: MessageView[];
  exports: ExportView[];
  chatQueue: string[];

  previewVersion: VersionWithScript | null;
  compareMode: boolean;
  compareVersion: VersionWithScript | null;

  playheadMs: number;
  seekSeq: number;
  playing: boolean;
  loop: boolean;
  muted: boolean;
  safeZone: boolean;
  captionsVisible: boolean;
  playbackRate: number;

  selection: Selection | null;
  zoom: number;

  chatOpen: boolean;
  inspectorOpen: boolean;
  timelineOpen: boolean;
  inspectorTab: InspectorTab;
  exportOpen: boolean;
  exportPanelOpen: boolean;

  undoStack: EditScript[];
  redoStack: EditScript[];
  pending: PendingBatch | null;
  saving: boolean;
  localRev: number;
  lastSavedAt: number | null;

  // actions
  init: (projectId: string, view: ProjectView | null) => void;
  syncProject: (view: ProjectView) => void;
  setMessages: (messages: MessageView[]) => void;
  setVersions: (versions: VersionView[]) => void;
  setExports: (exports: ExportView[]) => void;
  refreshVersions: () => Promise<void>;
  refreshProject: () => Promise<void>;
  refreshProjectForce: () => Promise<void>;

  applyOps: (ops: EditOp[], label: string, opts?: { silent?: boolean; coalesce?: string }) => boolean;
  lastCoalesce: string | null;
  flush: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  adoptScript: (script: EditScript, version: VersionView | null, opts?: { pushUndo?: boolean }) => void;

  seek: (ms: number) => void;
  setPlayheadFromPlayer: (ms: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  set: (patch: Partial<EditorState>) => void;
  select: (sel: Selection | null) => void;
  setZoom: (zoom: number) => void;
  setPreviewVersion: (v: VersionWithScript | null) => void;
  enqueueChat: (text: string) => void;
  shiftChatQueue: () => string | undefined;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const useEditor = create<EditorState>((set, get) => ({
  projectId: "",
  project: null,
  script: null,
  currentVersionId: null,
  versions: [],
  messages: [],
  exports: [],
  chatQueue: [],
  previewVersion: null,
  compareMode: false,
  compareVersion: null,
  playheadMs: 0,
  seekSeq: 0,
  playing: false,
  loop: false,
  muted: false,
  safeZone: false,
  captionsVisible: true,
  playbackRate: 1,
  selection: null,
  zoom: 60,
  chatOpen: true,
  inspectorOpen: true,
  timelineOpen: true,
  inspectorTab: "selection",
  exportOpen: false,
  exportPanelOpen: false,
  undoStack: [],
  redoStack: [],
  pending: null,
  saving: false,
  localRev: 0,
  lastSavedAt: null,
  lastCoalesce: null,

  init: (projectId, view) => {
    if (get().projectId === projectId && get().project) return;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    set({
      projectId,
      project: view,
      script: view?.currentVersion?.script ?? null,
      currentVersionId: view?.currentVersionId ?? null,
      versions: [],
      messages: [],
      exports: [],
      chatQueue: [],
      previewVersion: null,
      compareMode: false,
      compareVersion: null,
      playheadMs: 0,
      playing: false,
      selection: null,
      undoStack: [],
      redoStack: [],
      pending: null,
      saving: false,
      localRev: 0,
    });
  },

  syncProject: (view) => {
    const s = get();
    const patch: Partial<EditorState> = { project: view };
    const serverVersion = view.currentVersionId;
    if (serverVersion && serverVersion !== s.currentVersionId && !s.pending && !s.saving && view.currentVersion) {
      // Someone else (the agent, a restore, another tab) produced a new version: adopt it, keep it undoable.
      patch.script = view.currentVersion.script;
      patch.currentVersionId = serverVersion;
      patch.lastCoalesce = null;
      if (s.script) patch.undoStack = [...s.undoStack.slice(-49), s.script];
      patch.redoStack = [];
      patch.previewVersion = null;
      if (s.selection) patch.selection = selectionStillValid(view.currentVersion.script, s.selection) ? s.selection : null;
    } else if (!s.script && view.currentVersion) {
      patch.script = view.currentVersion.script;
      patch.currentVersionId = serverVersion;
    }
    set(patch);
    if (view.versionCount !== (s.project?.versionCount ?? -1)) void get().refreshVersions();
  },

  setMessages: (messages) => set({ messages }),
  setVersions: (versions) => set({ versions }),
  setExports: (exports) => set({ exports }),

  refreshVersions: async () => {
    const { projectId } = get();
    if (!projectId) return;
    try {
      const res = await api<{ versions: VersionView[] }>(`/api/projects/${projectId}/versions`);
      set({ versions: res.versions });
    } catch {
      /* ignore */
    }
  },

  refreshProjectForce: async () => {
    const { projectId } = get();
    try {
      const view = await api<ProjectView>(`/api/projects/${projectId}`);
      set({ project: view });
    } catch {
      /* ignore */
    }
  },

  refreshProject: async () => {
    const { projectId } = get();
    try {
      const view = await api<ProjectView>(`/api/projects/${projectId}`);
      get().syncProject(view);
    } catch {
      /* ignore */
    }
  },

  applyOps: (ops, label, opts) => {
    const s = get();
    if (!s.script) return false;
    if (s.previewVersion) {
      toast.info("You are previewing an older version", "Restore it to edit from here.");
      return false;
    }
    let next: EditScript;
    try {
      next = applyOpsEdl(s.script, ops);
    } catch (e) {
      if (!opts?.silent) toast.error("Can't do that", e instanceof OpError ? e.message : "Invalid edit");
      return false;
    }
    const pending: PendingBatch = s.pending ? { ops: [...s.pending.ops, ...ops], labels: [...s.pending.labels, label] } : { ops: [...ops], labels: [label] };
    // Continuous controls (sliders) pass a coalesce key: successive changes share one undo entry.
    const coalesced = !!opts?.coalesce && s.lastCoalesce === opts.coalesce;
    set({
      script: next,
      undoStack: coalesced ? s.undoStack : [...s.undoStack.slice(-49), s.script],
      redoStack: [],
      pending,
      lastCoalesce: opts?.coalesce ?? null,
      localRev: s.localRev + 1,
      selection: s.selection && selectionStillValid(next, s.selection) ? s.selection : s.selection?.kind === "captions" ? s.selection : null,
    });
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => void get().flush(), FLUSH_MS);
    return true;
  },

  flush: async () => {
    const s = get();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!s.pending || !s.script || s.saving) {
      if (s.pending && s.saving) {
        // a save is in flight; try again after it finishes
        flushTimer = setTimeout(() => void get().flush(), FLUSH_MS);
      }
      return;
    }
    const batch = s.pending;
    const script = s.script;
    const baseVersionId = s.currentVersionId;
    set({ pending: null, saving: true });
    try {
      const label = Array.from(new Set(batch.labels)).join(", ").slice(0, 200);
      const res = await api<OpsResponse>(`/api/projects/${s.projectId}/ops`, {
        method: "POST",
        json: { ops: batch.ops, label, script, baseVersionId: baseVersionId ?? undefined },
      });
      set((st) => ({
        saving: false,
        currentVersionId: res.version.id,
        versions: [res.version, ...st.versions.filter((v) => v.id !== res.version.id)],
        lastSavedAt: Date.now(),
        project: st.project ? { ...st.project, currentVersionId: res.version.id, versionCount: st.project.versionCount + 1 } : st.project,
      }));
      if (get().pending) void get().flush();
    } catch (e) {
      set({ saving: false });
      const msg = e instanceof Error ? e.message : "Save failed";
      if (/changed since/i.test(msg)) {
        // Someone else (the agent, another tab) saved first: rebase this batch on the latest version and retry once.
        await get().refreshProjectForce();
        const latest = get().project?.currentVersion;
        if (!latest) return;
        let rebased: EditScript | null = null;
        try {
          rebased = applyOpsEdl(latest.script, batch.ops);
        } catch {
          rebased = null;
        }
        if (!rebased) {
          toast.error("This project changed elsewhere", "Your last edit could not be re-applied to the newer version.");
          get().adoptScript(latest.script, { ...latest }, { pushUndo: false });
          return;
        }
        set((st) => ({ script: rebased, currentVersionId: latest.id, undoStack: [...st.undoStack.slice(-49), latest.script], redoStack: [], pending: { ops: batch.ops, labels: batch.labels }, versions: [{ ...latest }, ...st.versions.filter((v) => v.id !== latest.id)] }));
        toast.info("Merged with a newer version", "Your edit was re-applied on top of it.");
        await get().flush();
      } else {
        toast.error("Couldn't save your edit", msg);
        // keep the ops so a later edit retries them
        set((st) => ({ pending: st.pending ? { ops: [...batch.ops, ...st.pending.ops], labels: [...batch.labels, ...st.pending.labels] } : batch }));
      }
    }
  },

  undo: () => {
    const s = get();
    const prev = s.undoStack[s.undoStack.length - 1];
    if (!prev || !s.script) return;
    set({ script: prev, lastCoalesce: null, undoStack: s.undoStack.slice(0, -1), redoStack: [...s.redoStack, s.script], localRev: s.localRev + 1, selection: s.selection && selectionStillValid(prev, s.selection) ? s.selection : null });
    queueReplace(prev, "Undo", set, get);
  },

  redo: () => {
    const s = get();
    const next = s.redoStack[s.redoStack.length - 1];
    if (!next || !s.script) return;
    set({ script: next, lastCoalesce: null, redoStack: s.redoStack.slice(0, -1), undoStack: [...s.undoStack, s.script], localRev: s.localRev + 1, selection: s.selection && selectionStillValid(next, s.selection) ? s.selection : null });
    queueReplace(next, "Redo", set, get);
  },

  adoptScript: (script, version, opts) => {
    const s = get();
    set({
      script,
      lastCoalesce: null,
      currentVersionId: version?.id ?? s.currentVersionId,
      undoStack: opts?.pushUndo === false || !s.script ? s.undoStack : [...s.undoStack.slice(-49), s.script],
      redoStack: [],
      previewVersion: null,
      pending: null,
      versions: version ? [version, ...s.versions.filter((v) => v.id !== version.id)] : s.versions,
      selection: s.selection && selectionStillValid(script, s.selection) ? s.selection : null,
    });
  },

  seek: (ms) => {
    const s = get();
    const dur = (s.previewVersion?.script ?? s.script)?.output.durationMs ?? 0;
    set({ playheadMs: Math.max(0, Math.min(dur, Math.round(ms))), seekSeq: s.seekSeq + 1 });
  },
  setPlayheadFromPlayer: (ms) => set({ playheadMs: ms }),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  set: (patch) => set(patch),
  select: (sel) => set({ selection: sel, inspectorTab: sel ? "selection" : get().inspectorTab, inspectorOpen: sel ? true : get().inspectorOpen }),
  setZoom: (zoom) => set({ zoom: Math.max(8, Math.min(600, zoom)) }),
  setPreviewVersion: (v) => set({ previewVersion: v, playing: false }),
  enqueueChat: (text) => set((s) => ({ chatQueue: [...s.chatQueue, text] })),
  shiftChatQueue: () => {
    const [first, ...rest] = get().chatQueue;
    set({ chatQueue: rest });
    return first;
  },
}));

function queueReplace(script: EditScript, label: string, set: (p: Partial<EditorState>) => void, get: () => EditorState) {
  // Undo/redo replaces whatever batch is pending: the resulting script is authoritative.
  set({ pending: { ops: [{ op: "replaceScript", script }], labels: [label] } });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void get().flush(), FLUSH_MS);
}

export function selectionStillValid(script: EditScript, sel: Selection): boolean {
  switch (sel.kind) {
    case "clip":
      return script.tracks.some((t) => t.kind === "video" && t.clips.some((c) => c.id === sel.id));
    case "audio":
      return script.tracks.some((t) => t.kind === "audio" && t.clips.some((c) => c.id === sel.id));
    case "graphic":
      return script.tracks.some((t) => t.kind === "graphics" && t.items.some((g) => g.id === sel.id));
    case "captions":
      return true;
  }
}

/** The script currently shown in the preview (a previewed version or the working script). */
export function useDisplayScript(): EditScript | null {
  return useEditor((s) => s.previewVersion?.script ?? s.script);
}

export function useSelectedClip() {
  const script = useEditor((s) => s.script);
  const selection = useEditor((s) => s.selection);
  return React.useMemo(() => {
    if (!script || selection?.kind !== "clip") return null;
    for (const t of script.tracks) {
      if (t.kind !== "video") continue;
      const clip = t.clips.find((c) => c.id === selection.id);
      if (clip) return { clip, track: t };
    }
    return null;
  }, [script, selection]);
}

export function useSelectedAudio() {
  const script = useEditor((s) => s.script);
  const selection = useEditor((s) => s.selection);
  return React.useMemo(() => {
    if (!script || selection?.kind !== "audio") return null;
    for (const t of script.tracks) {
      if (t.kind !== "audio") continue;
      const clip = t.clips.find((c) => c.id === selection.id);
      if (clip) return { clip, track: t };
    }
    return null;
  }, [script, selection]);
}

export function useSelectedGraphic() {
  const script = useEditor((s) => s.script);
  const selection = useEditor((s) => s.selection);
  return React.useMemo(() => {
    if (!script || selection?.kind !== "graphic") return null;
    for (const t of script.tracks) {
      if (t.kind !== "graphics") continue;
      const item = t.items.find((g) => g.id === selection.id);
      if (item) return { item, track: t };
    }
    return null;
  }, [script, selection]);
}

/** Flush pending ops immediately (used before navigation / export). */
export async function flushNow() {
  await useEditor.getState().flush();
}
