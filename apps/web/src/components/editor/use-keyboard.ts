"use client";
import * as React from "react";
import { useEditor } from "@/lib/editor/store";
import { deleteSelection, setInOutAtPlayhead, splitAtPlayhead } from "@/lib/editor/commands";

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Global editor shortcuts: space play/pause, J/K/L, I/O in/out, Cmd+Z / Shift+Cmd+Z,
 * Delete, S split, C captions, Esc deselect, arrows step, +/- zoom.
 */
export function useEditorKeyboard() {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        if (st.exportOpen) st.set({ exportOpen: false });
        else if (st.previewVersion) st.setPreviewVersion(null);
        else st.select(null);
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }
      if (isTyping(e)) return;
      if (!st.script) return;
      const fps = st.script.output.fps || 30;
      const frame = 1000 / fps;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && e.key === "a") {
        e.preventDefault();
        return;
      }
      if (mod) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          st.togglePlaying();
          break;
        case "k":
        case "K":
          st.setPlaying(false);
          st.set({ playbackRate: 1 });
          break;
        case "l":
        case "L":
          if (st.playing) st.set({ playbackRate: Math.min(4, st.playbackRate * 2) });
          else st.set({ playing: true, playbackRate: 1 });
          break;
        case "j":
        case "J":
          st.setPlaying(false);
          st.seek(st.playheadMs - (e.shiftKey ? 5000 : 1000));
          break;
        case "i":
        case "I":
          setInOutAtPlayhead("in");
          break;
        case "o":
        case "O":
          setInOutAtPlayhead("out");
          break;
        case "s":
        case "S":
          splitAtPlayhead();
          break;
        case "c":
        case "C":
          st.set({ captionsVisible: !st.captionsVisible });
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          deleteSelection();
          break;
        case "ArrowLeft":
          e.preventDefault();
          st.seek(st.playheadMs - (e.shiftKey ? 1000 : frame));
          break;
        case "ArrowRight":
          e.preventDefault();
          st.seek(st.playheadMs + (e.shiftKey ? 1000 : frame));
          break;
        case "Home":
          st.seek(0);
          break;
        case "End":
          st.seek(st.script.output.durationMs);
          break;
        case "=":
        case "+":
          st.setZoom(st.zoom * 1.25);
          break;
        case "-":
        case "_":
          st.setZoom(st.zoom / 1.25);
          break;
        case "[":
          st.set({ timelineOpen: !st.timelineOpen });
          break;
        case "\\":
          st.set({ chatOpen: !st.chatOpen });
          break;
        case "]":
          st.set({ inspectorOpen: !st.inspectorOpen });
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
