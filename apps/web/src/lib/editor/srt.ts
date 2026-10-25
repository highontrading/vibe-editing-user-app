import type { Word } from "@vibe/edl";

function ts(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = Math.floor(ms % 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${r.toString().padStart(3, "0")}`;
}

/** Group words into SRT cues of up to `perLine` words / `maxGapMs` gaps. */
export function wordsToSrt(words: Word[], perLine = 6, maxGapMs = 700): string {
  const cues: { start: number; end: number; text: string[] }[] = [];
  let cur: { start: number; end: number; text: string[] } | null = null;
  for (const w of [...words].sort((a, b) => a.t - b.t)) {
    if (!cur || cur.text.length >= perLine || w.t - cur.end > maxGapMs) {
      cur = { start: w.t, end: w.t + w.d, text: [w.text] };
      cues.push(cur);
    } else {
      cur.text.push(w.text);
      cur.end = w.t + w.d;
    }
  }
  return cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text.join(" ")}\n`).join("\n");
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
