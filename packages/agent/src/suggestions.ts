/** Suggestion chips shown under the chat, derived from the current script state. */
import { getTrack, mainClips, type EditScript } from "@vibe/edl";

export function quickSuggestions(script: EditScript): string[] {
  const out: string[] = [];
  const dur = script.output.durationMs;
  const gfx = getTrack(script, "graphics")?.items ?? [];
  const caps = getTrack(script, "captions");
  const music = getTrack(script, "audio", (t) => t.role === "music");
  const hasMusic = !!music?.clips.length;
  const hasTitle = gfx.some((g) => g.component === "KineticTitle");
  const hasEndCard = gfx.some((g) => g.component === "EndCard");
  const broll = script.tracks.some((t) => t.kind === "video" && t.layer > 0 && t.clips.length > 0);
  const clips = mainClips(script);
  const punched = clips.some((c) => c.transform.scale > 1.02);

  if (clips.length > 1) out.push("Tighten pacing");
  if (!hasTitle) out.push("Add a hook title");
  if (caps?.enabled && caps.words.length && caps.style !== "hormozi") out.push("Try Hormozi captions");
  if (caps?.enabled && caps.words.length && caps.style === "hormozi") out.push("Try Bold Pop captions");
  if (dur > 22_000) out.push("Make a 15s cut");
  if (hasMusic) out.push(music!.clips[0]!.gainDb > -14 ? "Make the music quieter" : "Swap music to cinematic");
  else if (clips.length) out.push("Add lo-fi music");
  if (!hasEndCard && dur > 10_000) out.push("Add an end card");
  if (!broll && dur > 15_000 && caps?.words.length) out.push("Add b-roll");
  if (!punched && clips.length > 2) out.push("Add punch-in zooms");
  if (script.global.colorPreset === "none") out.push("Try a warm film grade");
  if (caps && !caps.enabled) out.push("Turn captions on");
  out.push("Make captions bigger");
  return [...new Set(out)].slice(0, 4);
}
