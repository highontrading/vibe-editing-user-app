"use client";
/** Per-project caption dictionary (names, brand words) kept in localStorage. */
import * as React from "react";

const key = (projectId: string) => `vibe:dictionary:${projectId}`;

export function readDictionary(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(key(projectId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function writeDictionary(projectId: string, words: string[]) {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(words));
  } catch {
    /* ignore */
  }
}

export function useDictionary(projectId: string) {
  const [words, setWords] = React.useState<string[]>([]);
  React.useEffect(() => setWords(readDictionary(projectId)), [projectId]);
  const update = React.useCallback(
    (next: string[]) => {
      setWords(next);
      writeDictionary(projectId, next);
    },
    [projectId],
  );
  return [words, update] as const;
}

/** Fix the casing/spelling of transcript words that match a dictionary entry case-insensitively (ignoring punctuation). */
export function applyDictionary(text: string, dict: string[]): string | null {
  const strip = (s: string) => s.replace(/[^\p{L}\p{N}'’]/gu, "").toLowerCase();
  const core = strip(text);
  if (!core) return null;
  for (const entry of dict) {
    if (strip(entry) === core && entry !== text.replace(/[^\p{L}\p{N}'’]/gu, "")) {
      // keep surrounding punctuation
      const m = text.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
      return m ? `${m[1]}${entry}${m[3]}` : entry;
    }
  }
  return null;
}
