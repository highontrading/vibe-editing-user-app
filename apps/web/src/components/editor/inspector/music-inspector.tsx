"use client";
import * as React from "react";
import { Music, Loader2, Ban, Volume2 } from "lucide-react";
import { MUSIC_MOOD_INFO, getTrack, type EditScript, type MusicMood } from "@vibe/edl";
import { api, cn } from "@/lib/utils";
import { fmtDb, fmtShort } from "@/lib/editor/format";
import { useEditor } from "@/lib/editor/store";
import type { VersionView } from "@/lib/editor/types";
import { toast } from "@/components/ui/toast";
import { Field, Section, Slider } from "../panel";
import { Toggle } from "./clip-inspector";

export function MusicInspector() {
  const script = useEditor((s) => s.script);
  const projectId = useEditor((s) => s.projectId);
  const applyOps = useEditor((s) => s.applyOps);
  const flush = useEditor((s) => s.flush);
  const [busy, setBusy] = React.useState<string | null>(null);
  if (!script) return null;
  const music = getTrack(script, "audio", (t) => t.role === "music");
  const clip = music?.clips[0];
  const asset = clip ? script.assets[clip.assetId] : undefined;
  const currentMood = (clip?.label?.split(" · ")[0] as MusicMood | undefined) ?? undefined;

  const pick = async (mood: MusicMood | null) => {
    setBusy(mood ?? "none");
    try {
      await flush();
      const res = await api<{ version: VersionView; script: EditScript }>(`/api/projects/${projectId}/music`, { method: "POST", json: { mood, gainDb: clip?.gainDb ?? -18, ducking: clip?.ducking ?? true } });
      useEditor.getState().adoptScript(res.script, res.version);
      toast.success(mood ? `Music: ${mood}` : "Music removed");
    } catch (e) {
      toast.error("Couldn't change the music", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const patch = (p: Record<string, unknown>, label: string, coalesce?: string) => clip && applyOps([{ op: "updateAudioClip", clipId: clip.id, patch: p }], label, coalesce ? { coalesce: `music:${coalesce}` } : undefined);

  return (
    <div className="flex flex-col">
      <Section title="Music" right={music ? <button type="button" onClick={() => applyOps([{ op: "setTrackMuted", trackId: music.id, muted: !music.muted }], music.muted ? "Unmute music" : "Mute music")} className={cn("text-[10px]", music.muted ? "text-danger" : "text-muted hover:text-fg")}>{music.muted ? "Muted" : "Mute"}</button> : null}>
        {clip ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-bg-2 px-2.5 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsla(265,45%,32%,1)]"><Music className="h-4 w-4 text-white/90" /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{clip.label ?? asset?.name ?? "Music bed"}</div>
              <div className="font-mono text-[10px] text-muted">{fmtDb(clip.gainDb)}{clip.ducking ? " · ducked" : ""}{clip.loop ? " · loop" : ""}{asset?.durationMs ? ` · ${fmtShort(asset.durationMs)}` : ""}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border px-3 py-2 text-center text-[11px] text-muted">No music yet. Pick a mood below.</div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          {MUSIC_MOOD_INFO.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!!busy}
              onClick={() => pick(m.id)}
              title={`${m.description} · ${m.bpm[0]}–${m.bpm[1]} bpm`}
              className={cn("flex items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-left text-xs transition-colors", currentMood === m.id ? "border-accent/60 bg-accent/10 text-accent" : "border-border bg-bg-2 text-fg hover:border-white/25")}
            >
              <span>
                <span className="block font-medium">{m.name}</span>
                <span className="block text-[10px] text-muted">{m.bpm[0]}–{m.bpm[1]} bpm</span>
              </span>
              {busy === m.id && <Loader2 className="h-3 w-3 animate-spin" />}
            </button>
          ))}
          <button type="button" disabled={!!busy || !clip} onClick={() => pick(null)} className="flex items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2 py-1.5 text-left text-xs text-muted hover:border-danger/40 hover:text-danger disabled:opacity-40">
            {busy === "none" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />} No music
          </button>
        </div>
      </Section>
      {clip && (
        <Section title="Mix">
          <Field label="Gain" hint={fmtDb(clip.gainDb)}>
            <div className="flex items-center gap-2">
              <Volume2 className="h-3.5 w-3.5 text-muted" />
              <Slider min={-40} max={6} step={1} value={clip.gainDb} onChange={(v) => patch({ gainDb: v }, "Music gain", "gain")} />
            </div>
          </Field>
          <label className="flex items-center justify-between text-xs">
            <span>
              Duck under speech
              <span className="block text-[10px] text-muted">Lowers the bed while someone talks</span>
            </span>
            <Toggle checked={clip.ducking} onChange={(on) => patch({ ducking: on }, on ? "Ducking on" : "Ducking off")} />
          </label>
          <Field label="Fade in" hint={fmtShort(clip.fadeInMs)}>
            <Slider min={0} max={5000} step={100} value={clip.fadeInMs} onChange={(v) => patch({ fadeInMs: v }, "Fade in", "fin")} />
          </Field>
          <Field label="Fade out" hint={fmtShort(clip.fadeOutMs)}>
            <Slider min={0} max={8000} step={100} value={clip.fadeOutMs} onChange={(v) => patch({ fadeOutMs: v }, "Fade out", "fout")} />
          </Field>
          <Field label="Start offset in track" hint={fmtShort(clip.inMs)}>
            <Slider min={0} max={Math.max(1000, (asset?.durationMs ?? 60000) - 5000)} step={500} value={clip.inMs} onChange={(v) => patch({ inMs: v }, "Music offset", "in")} />
          </Field>
        </Section>
      )}
    </div>
  );
}
