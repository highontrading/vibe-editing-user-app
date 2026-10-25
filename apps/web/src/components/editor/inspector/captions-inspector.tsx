"use client";
import * as React from "react";
import { Search, Download, Plus, X, Wand2, Check } from "lucide-react";
import { CAPTION_STYLES, CaptionSettingsSchema, getTrack, type CaptionSettings, type CaptionStyleId } from "@vibe/edl";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/editor/format";
import { useEditor } from "@/lib/editor/store";
import { applyDictionary, useDictionary } from "@/lib/editor/dictionary";
import { downloadText, wordsToSrt } from "@/lib/editor/srt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Field, Section, SegmentedControl, Slider } from "../panel";
import { Toggle } from "./clip-inspector";
import { CaptionStyleMock } from "./caption-style-mock";

export function CaptionsInspector() {
  const script = useEditor((s) => s.script);
  const applyOps = useEditor((s) => s.applyOps);
  const projectId = useEditor((s) => s.projectId);
  const track = script ? getTrack(script, "captions") : undefined;
  const settings: CaptionSettings = track?.settings ?? CaptionSettingsSchema.parse({});
  const set = (patch: Partial<CaptionSettings>, label: string, coalesce?: string) => applyOps([{ op: "setCaptionSettings", settings: patch }], label, coalesce ? { coalesce: `cap:${coalesce}` } : undefined);
  if (!script) return null;
  const words = track?.words ?? [];
  const enabled = track?.enabled ?? true;

  return (
    <div className="flex flex-col">
      <Section
        title="Captions"
        right={
          <label className="flex items-center gap-2 text-[11px] text-muted">
            {enabled ? "On" : "Off"} <Toggle checked={enabled} onChange={(on) => applyOps([{ op: "setCaptionsEnabled", enabled: on }], on ? "Captions on" : "Captions off")} />
          </label>
        }
      >
        <div className="grid grid-cols-3 gap-1.5">
          {CAPTION_STYLES.map((s) => {
            const active = track?.style === s.id;
            return (
              <button
                key={s.id}
                type="button"
                title={s.description}
                onClick={() => applyOps([{ op: "setCaptionStyle", style: s.id }, { op: "setCaptionSettings", settings: s.defaults }], `Captions: ${s.name}`)}
                className={cn("group flex flex-col gap-1 rounded-lg border p-1 text-left transition-colors", active ? "border-accent bg-accent/10" : "border-border bg-bg-2 hover:border-white/25")}
              >
                <div className="aspect-[4/3] w-full">
                  <CaptionStyleMock id={s.id as CaptionStyleId} highlight={s.defaults.highlightColor} />
                </div>
                <span className={cn("truncate px-0.5 text-[10px] font-medium", active ? "text-accent" : "text-muted group-hover:text-fg")}>{s.name}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Settings">
        <Field label="Font size" hint={`${settings.fontSize}px`}>
          <Slider min={24} max={140} step={2} value={settings.fontSize} onChange={(v) => set({ fontSize: v }, "Caption size", "size")} />
        </Field>
        <Field label="Position">
          <SegmentedControl value={settings.position} options={[{ value: "top", label: "Top" }, { value: "center", label: "Center" }, { value: "bottom", label: "Bottom" }]} onChange={(v) => set({ position: v }, `Captions ${v}`)} />
        </Field>
        <Field label="Fine offset" hint={settings.offset.toFixed(2)}>
          <Slider min={-1} max={1} step={0.05} value={settings.offset} onChange={(v) => set({ offset: v }, "Caption offset", "offset")} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Text" value={settings.color} onChange={(v) => set({ color: v }, "Caption colour", "color")} />
          <ColorField label="Highlight" value={settings.highlightColor} onChange={(v) => set({ highlightColor: v }, "Highlight colour", "hl")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center justify-between rounded-md border border-border bg-bg-2 px-2 py-1.5 text-xs"><span>Uppercase</span><Toggle checked={settings.uppercase} onChange={(on) => set({ uppercase: on }, "Uppercase")} /></label>
          <label className="flex items-center justify-between rounded-md border border-border bg-bg-2 px-2 py-1.5 text-xs"><span>Emoji</span><Toggle checked={settings.emoji} onChange={(on) => set({ emoji: on }, "Emoji")} /></label>
        </div>
        <Field label="Words per line" hint={String(settings.maxWordsPerLine)}>
          <Slider min={1} max={10} step={1} value={settings.maxWordsPerLine} onChange={(v) => set({ maxWordsPerLine: v }, "Words per line", "wpl")} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mode">
            <SegmentedControl value={settings.mode} options={[{ value: "word", label: "Word" }, { value: "line", label: "Line" }]} onChange={(v) => set({ mode: v }, `Mode: ${v}`)} />
          </Field>
          <Field label="Animation">
            <select value={settings.animation} onChange={(e) => set({ animation: e.target.value as CaptionSettings["animation"] }, "Caption animation")} className="h-[26px] rounded-md border border-border bg-bg-2 px-2 text-[11px]">
              {["pop", "fade", "slide", "none"].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <WordEditor projectId={projectId} words={words} onReplace={(i, text) => applyOps([{ op: "replaceWordText", wordIndex: i, text }], "Edit caption word")} />

      <Section title="Export">
        <Button size="sm" variant="secondary" disabled={!words.length} onClick={() => downloadText(`${(script.meta.title ?? "captions").replace(/[^\w-]+/g, "_")}.srt`, wordsToSrt(words, settings.maxWordsPerLine + 2), "text/plain")}>
          <Download className="h-3 w-3" /> Download SRT
        </Button>
      </Section>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-2 px-2 py-1.5 text-xs">
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-muted">{value.toUpperCase()}</span>
        <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} className="h-5 w-6 cursor-pointer rounded border border-border bg-transparent p-0" />
      </span>
    </label>
  );
}

function toHex(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : /^#[0-9a-f]{3}$/i.test(c) ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : "#ffffff";
}

function WordEditor({ projectId, words, onReplace }: { projectId: string; words: { t: number; d: number; text: string }[]; onReplace: (i: number, text: string) => void }) {
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState("");
  const [dict, setDict] = useDictionary(projectId);
  const [newWord, setNewWord] = React.useState("");
  const seek = useEditor((s) => s.seek);
  const playhead = useEditor((s) => s.playheadMs);
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const idx = words.map((w, i) => i).filter((i) => !needle || words[i]!.text.toLowerCase().includes(needle));
    return idx.slice(0, 400);
  }, [q, words]);
  const activeIdx = React.useMemo(() => words.findIndex((w) => playhead >= w.t && playhead < w.t + w.d), [words, playhead]);

  const applyDict = () => {
    let n = 0;
    const ops: import("@vibe/edl").EditOp[] = [];
    words.forEach((w, i) => {
      const fixed = applyDictionary(w.text, dict);
      if (fixed && fixed !== w.text) {
        ops.push({ op: "replaceWordText", wordIndex: i, text: fixed });
        n++;
      }
    });
    if (!n) return toast.info("Nothing to fix", "No caption words match your dictionary.");
    useEditor.getState().applyOps(ops, `Dictionary: fixed ${n} word${n === 1 ? "" : "s"}`);
    toast.success(`Fixed ${n} word${n === 1 ? "" : "s"}`);
  };

  return (
    <Section title={`Words · ${words.length}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search words…" className="h-8 pl-7 text-xs" />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-bg-2">
        {filtered.length === 0 && <div className="p-3 text-center text-[11px] text-muted">{words.length ? "No matches" : "No captions yet"}</div>}
        {filtered.map((i) => {
          const w = words[i]!;
          const isEditing = editing === i;
          return (
            <div key={`${i}-${w.t}`} className={cn("flex items-center gap-2 border-b border-border/60 px-2 py-1 text-xs last:border-0", i === activeIdx && "bg-accent/10")}>
              <button type="button" onClick={() => seek(w.t)} className="w-12 shrink-0 text-left font-mono text-[10px] text-muted hover:text-fg">{fmtTime(w.t)}</button>
              {isEditing ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (draft.trim() && draft !== w.text) onReplace(i, draft.trim());
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="h-6 flex-1 rounded border border-accent/50 bg-bg px-1.5 text-xs outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(i);
                    setDraft(w.text);
                  }}
                  className="flex-1 truncate rounded px-1 text-left hover:bg-white/5"
                  title="Click to edit"
                >
                  {w.text}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="rounded-md border border-border bg-bg-2 p-2">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-medium">Dictionary</span>
          <button type="button" onClick={applyDict} disabled={!dict.length || !words.length} className="inline-flex items-center gap-1 text-accent disabled:opacity-40"><Wand2 className="h-3 w-3" /> Apply</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {dict.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-3 px-2 py-0.5 text-[10px]">
              {d}
              <button type="button" onClick={() => setDict(dict.filter((x) => x !== d))} className="text-muted hover:text-fg" aria-label={`Remove ${d}`}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          {!dict.length && <span className="text-[10px] text-muted">Names and brand words to spell correctly.</span>}
        </div>
        <div className="mt-1.5 flex gap-1">
          <Input value={newWord} onChange={(e) => setNewWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newWord.trim()) { setDict(Array.from(new Set([...dict, newWord.trim()]))); setNewWord(""); } }} placeholder="Add word…" className="h-7 text-xs" />
          <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => { if (newWord.trim()) { setDict(Array.from(new Set([...dict, newWord.trim()]))); setNewWord(""); } }}><Plus className="h-3 w-3" /></Button>
        </div>
      </div>
      {activeIdx >= 0 && <div className="text-[10px] text-muted"><Check className="mr-1 inline h-3 w-3 text-success" />Highlighted row follows the playhead.</div>}
    </Section>
  );
}
