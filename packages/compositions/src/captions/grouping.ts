import type { Word } from "@vibe/edl";

export interface CaptionLine {
  index: number;
  words: Word[];
  /** Output-timeline ms when the line appears. */
  startMs: number;
  /** Output-timeline ms when the line disappears (held until the next line when the gap is short). */
  endMs: number;
}

export const LINE_GAP_MS = 600;
export const LINE_HOLD_MS = 260;

/** Group words into caption lines by maxWordsPerLine and natural pauses (> LINE_GAP_MS). */
export function groupWords(words: Word[], maxWordsPerLine: number, gapMs = LINE_GAP_MS): CaptionLine[] {
  const max = Math.max(1, Math.floor(maxWordsPerLine) || 1);
  const sorted = [...words].filter((w) => w.text.trim().length > 0).sort((a, b) => a.t - b.t);
  const lines: CaptionLine[] = [];
  let cur: Word[] = [];
  let prevEnd = -Infinity;
  const flush = () => {
    if (cur.length) {
      lines.push({ index: lines.length, words: cur, startMs: cur[0].t, endMs: cur[cur.length - 1].t + cur[cur.length - 1].d });
      cur = [];
    }
  };
  for (const w of sorted) {
    const gap = w.t - prevEnd;
    const endsSentence = cur.length > 0 && /[.!?]$/.test(cur[cur.length - 1].text);
    if (cur.length >= max || gap > gapMs || (endsSentence && cur.length >= 2)) flush();
    cur.push(w);
    prevEnd = w.t + w.d;
  }
  flush();
  // Hold each line until the next one starts when the pause is short, so the screen never flickers empty.
  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1];
    if (next && next.startMs - lines[i].endMs <= gapMs) lines[i].endMs = next.startMs;
    else lines[i].endMs += LINE_HOLD_MS;
  }
  return lines;
}

export function lineAt(lines: CaptionLine[], tMs: number): CaptionLine | undefined {
  // Lines are sorted; linear scan is fine for typical caption counts, but bail early.
  for (const l of lines) {
    if (tMs < l.startMs) return undefined;
    if (tMs < l.endMs) return l;
  }
  return undefined;
}

/** Is any caption word being spoken at `tMs`? (Used by music ducking.) */
export function speechActiveAt(words: Word[], tMs: number): boolean {
  for (const w of words) if (tMs >= w.t && tMs < w.t + w.d) return true;
  return false;
}
