/**
 * Speech-to-text. Deepgram (nova-3) when DEEPGRAM_API_KEY is set; otherwise a
 * deterministic MOCK that turns the non-silent spans of the audio into
 * placeholder words so captions, cuts and hooks are exercised end to end.
 */
import fsp from "node:fs/promises";
import { env } from "@vibe/core";
import type { TranscriptWord } from "@vibe/edl";

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
}

export interface TranscriptResult {
  words: TranscriptWord[];
  segments: TranscriptSegment[];
  speakers: string[];
  text: string;
  language?: string;
  provider: "deepgram" | "mock";
}

export interface TranscribeOptions {
  wavPath: string;
  durationMs: number;
  /** Silence spans (from detectSilences) used by the mock to place speech. */
  silences?: { startMs: number; endMs: number }[];
  /** BCP-47 hint; Deepgram auto-detects when omitted. */
  language?: string;
}

export function transcriptionProvider(): "deepgram" | "mock" {
  return env.deepgramKey ? "deepgram" : "mock";
}

export async function transcribe(opts: TranscribeOptions): Promise<TranscriptResult> {
  if (env.deepgramKey) return transcribeDeepgram(opts);
  return mockTranscript(opts);
}

/* ------------------------------ Deepgram ------------------------------ */

interface DgWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: number;
  punctuated_word?: string;
}
interface DgResponse {
  results?: {
    channels?: Array<{ detected_language?: string; alternatives?: Array<{ transcript?: string; words?: DgWord[] }> }>;
    utterances?: Array<{ start: number; end: number; transcript: string; speaker?: number }>;
  };
}

function speakerLabel(n: number | undefined): string | undefined {
  if (n === undefined || n === null) return undefined;
  return String.fromCharCode(65 + (n % 26));
}

export async function transcribeDeepgram(opts: TranscribeOptions): Promise<TranscriptResult> {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    diarize: "true",
    utterances: "true",
    filler_words: "true",
  });
  if (opts.language) params.set("language", opts.language);
  else params.set("detect_language", "true");
  const body = await fsp.readFile(opts.wavPath);
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: `Token ${env.deepgramKey}`, "Content-Type": "audio/wav" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Deepgram ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as DgResponse;
  const channel = json.results?.channels?.[0];
  const alt = channel?.alternatives?.[0];
  const words: TranscriptWord[] = (alt?.words ?? []).map((w) => ({
    t: Math.round(w.start * 1000),
    d: Math.max(1, Math.round((w.end - w.start) * 1000)),
    text: w.punctuated_word ?? w.word,
    speaker: speakerLabel(w.speaker),
    confidence: w.confidence,
  }));
  let segments: TranscriptSegment[] = (json.results?.utterances ?? []).map((u) => ({
    startMs: Math.round(u.start * 1000),
    endMs: Math.round(u.end * 1000),
    text: u.transcript,
    speaker: speakerLabel(u.speaker),
  }));
  if (!segments.length && words.length) segments = segmentsFromWords(words);
  const speakers = [...new Set(words.map((w) => w.speaker).filter((s): s is string => !!s))];
  return {
    words,
    segments,
    speakers,
    text: alt?.transcript ?? words.map((w) => w.text).join(" "),
    language: channel?.detected_language ?? opts.language,
    provider: "deepgram",
  };
}

/* -------------------------------- Mock -------------------------------- */

const MOCK_VOCAB = ["speech", "here", "talking", "about", "this", "idea", "and", "why", "it", "matters", "so", "you", "can", "see", "the", "result"];

/** Non-silent spans of [0, durationMs]. */
export function speechSpans(durationMs: number, silences: { startMs: number; endMs: number }[] = [], minSpanMs = 300) {
  const spans: { startMs: number; endMs: number }[] = [];
  let cursor = 0;
  for (const s of [...silences].sort((a, b) => a.startMs - b.startMs)) {
    if (s.startMs > cursor) spans.push({ startMs: cursor, endMs: Math.min(s.startMs, durationMs) });
    cursor = Math.max(cursor, s.endMs);
  }
  if (cursor < durationMs) spans.push({ startMs: cursor, endMs: durationMs });
  return spans.filter((s) => s.endMs - s.startMs >= minSpanMs);
}

export function mockTranscript(opts: TranscribeOptions): TranscriptResult {
  const spans = speechSpans(opts.durationMs, opts.silences ?? []);
  const words: TranscriptWord[] = [];
  const segments: TranscriptSegment[] = [];
  const stepMs = 400; // 2.5 words / second
  let i = 0;
  for (const span of spans) {
    // Split long spans into ~8 s segments so "sentences" exist for jump cuts.
    for (let segStart = span.startMs; segStart < span.endMs; segStart += 8000) {
      const segEnd = Math.min(span.endMs, segStart + 8000);
      const segWords: TranscriptWord[] = [];
      for (let t = segStart; t + 200 <= segEnd; t += stepMs) {
        const text = MOCK_VOCAB[i % MOCK_VOCAB.length]!;
        i++;
        segWords.push({ t, d: Math.min(320, segEnd - t), text, speaker: "A", confidence: 1 });
      }
      if (!segWords.length) continue;
      const last = segWords[segWords.length - 1]!;
      last.text += ".";
      words.push(...segWords);
      segments.push({ startMs: segStart, endMs: segEnd, text: segWords.map((w) => w.text).join(" "), speaker: "A" });
    }
  }
  return {
    words,
    segments,
    speakers: words.length ? ["A"] : [],
    text: segments.map((s) => s.text).join(" "),
    language: "mock",
    provider: "mock",
  };
}

/** Group words into segments on sentence punctuation or pauses > 700 ms. */
export function segmentsFromWords(words: TranscriptWord[]): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  let cur: TranscriptWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    const first = cur[0]!;
    const last = cur[cur.length - 1]!;
    out.push({ startMs: first.t, endMs: last.t + last.d, text: cur.map((w) => w.text).join(" "), speaker: first.speaker });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    cur.push(w);
    const next = words[i + 1];
    const endsSentence = /[.!?]$/.test(w.text);
    const pause = next ? next.t - (w.t + w.d) : 0;
    if (endsSentence || pause > 700 || (next && next.speaker !== w.speaker)) flush();
  }
  flush();
  return out;
}
