/**
 * The OPS TOOL SET: tools wrapping edl ops (one op or a convenient macro each)
 * that Claude calls through the SDK tool runner. Every tool mutates the session's
 * working script via validated ops and returns a compact textual result so the
 * model can verify what happened. Also used by the director review pass.
 */
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  CAPTION_STYLE_IDS,
  COLOR_PRESETS,
  COMPONENT_CATALOG,
  EFFECT_TYPES,
  GRAPHIC_COMPONENT_IDS,
  GraphicItemSchema,
  MUSIC_MOODS,
  SFX_LIBRARY,
  TRANSITION_TYPES,
  clipDuration,
  getTrack,
  mainClips,
  type EditOp,
  type EditScript,
} from "@vibe/edl";
import type { MediaProvider, ProjectContext } from "./types";
import { OpRecorder, addBroll, addSfx, audioClipPatchOp, brollQuery, captionSettingsOp, normalizeEnds, setMusic, trimScriptToTarget, captionSettingsFor } from "./builder";
import { CaptionSettingsSchema } from "@vibe/edl";
import { fmtSec } from "./manifest";

export interface FinishPayload {
  summary: string;
  message: string;
  suggestions: string[];
}

/** Mutable working state shared by the tools during one agentic run. */
export class EditSession {
  rec: OpRecorder;
  log: string[] = [];
  finish?: FinishPayload;
  toolCalls = 0;
  constructor(
    public ctx: ProjectContext,
    script: EditScript,
    public media: MediaProvider,
  ) {
    this.rec = new OpRecorder(script);
  }
  get script() {
    return this.rec.script;
  }
  get ops(): EditOp[] {
    return this.rec.ops;
  }
  apply(op: EditOp, note?: string) {
    this.rec.apply(op);
    if (note) this.log.push(note);
  }
}

/* ------------------------------------------------------------------ */
/* State rendering                                                     */
/* ------------------------------------------------------------------ */

export function describeClips(script: EditScript): string {
  const words = getTrack(script, "captions")?.words ?? [];
  const lines = mainClips(script).map((c, i) => {
    const end = c.startMs + clipDuration(c);
    const inside = words.filter((w) => w.t >= c.startMs && w.t < end).map((w) => w.text);
    const text = inside.length ? ` "${inside.slice(0, 8).join(" ")}${inside.length > 8 ? " …" : ""}"` : "";
    const extras = [c.speed !== 1 ? `${c.speed}x` : "", c.transform.scale !== 1 ? `scale ${c.transform.scale}` : "", c.transitionIn ? `in:${c.transitionIn.type}` : "", c.effects.length ? `fx:${c.effects.map((e) => e.type).join("/")}` : ""].filter(Boolean).join(" ");
    return `${i + 1}. ${c.id} out ${fmtSec(c.startMs)}-${fmtSec(end)}s src ${fmtSec(c.inMs)}-${fmtSec(c.outMs)}s${extras ? ` [${extras}]` : ""}${text}${c.reason ? ` — ${c.reason}` : ""}`;
  });
  return lines.join("\n") || "(no clips)";
}

export function describeScriptState(script: EditScript): string {
  const parts: string[] = [];
  parts.push(`OUTPUT ${script.output.width}x${script.output.height} ${fmtSec(script.output.durationMs)}s, platform ${script.meta.platform ?? "custom"}, title "${script.meta.title ?? ""}", colour ${script.global.colorPreset}`);
  parts.push(`MAIN CLIPS:\n${describeClips(script)}`);
  for (const t of script.tracks) {
    if (t.kind === "video" && t.layer > 0 && t.clips.length) parts.push(`B-ROLL (${t.id}): ` + t.clips.map((c) => `${c.id} at ${fmtSec(c.startMs)}s for ${fmtSec(clipDuration(c))}s (${c.label ?? c.assetId})`).join("; "));
  }
  const caps = getTrack(script, "captions");
  if (caps) parts.push(`CAPTIONS: ${caps.enabled ? "on" : "off"}, style ${caps.style}, ${caps.words.length} words, settings ${JSON.stringify(caps.settings)}`);
  for (const t of script.tracks) {
    if (t.kind === "audio" && t.clips.length) parts.push(`${t.role.toUpperCase()}: ` + t.clips.map((c) => `${c.id} at ${fmtSec(c.startMs)}s gain ${c.gainDb} dB${c.ducking ? " ducked" : ""}${c.label ? ` (${c.label})` : ""}`).join("; "));
  }
  const gfx = getTrack(script, "graphics");
  if (gfx?.items.length) parts.push(`GRAPHICS: ` + gfx.items.map((g) => `${g.id} ${g.component} ${fmtSec(g.startMs)}-${fmtSec(g.startMs + g.durationMs)}s ${JSON.stringify(g.props)}`).join("; "));
  parts.push(`ASSETS: ` + Object.values(script.assets).map((a) => `${a.id} (${a.kind}${a.durationMs ? ` ${fmtSec(a.durationMs)}s` : ""})`).join(", "));
  return parts.join("\n");
}

function brief(session: EditSession, note: string): string {
  const s = session.script;
  return `${note}\nDuration now ${fmtSec(s.output.durationMs)}s, ${mainClips(s).length} clips.`;
}

function parseJsonObject(text: string | null | undefined): Record<string, unknown> {
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`propsJson is not valid JSON: ${(e as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("propsJson must be a JSON object");
  return parsed as Record<string, unknown>;
}

const ms = z.number().describe("milliseconds on the OUTPUT timeline");

/* ------------------------------------------------------------------ */
/* Tool definitions                                                    */
/* ------------------------------------------------------------------ */

export function makeTools(session: EditSession) {
  const count = () => void session.toolCalls++;
  const tools = [
    betaZodTool({
      name: "get_script_state",
      description: "Return the full current state of the working script (clips with ids and times, captions, audio, graphics). Call it first when you need ids or exact times before changing something.",
      strict: true,
      inputSchema: z.object({}),
      run: () => (count(), describeScriptState(session.script)),
    }),
    betaZodTool({
      name: "list_clips",
      description: "List the main-track clips with ids, output times, source times and the words spoken in each. Use it to find which clip to trim, delete or punch in.",
      strict: true,
      inputSchema: z.object({}),
      run: () => (count(), describeClips(session.script)),
    }),
    betaZodTool({
      name: "find_in_transcript",
      description: "Find where a phrase is spoken. Returns caption word indices and output times. Use it when the user refers to a moment by what is said ('the part where I mention pricing', 'where I cough').",
      strict: true,
      inputSchema: z.object({ query: z.string().describe("Words to look for, 1 to 6 words") }),
      run: ({ query }) => {
        count();
        const matches = findPhrase(session.script, query);
        if (!matches.length) return `No match for "${query}". Caption words available: ${(getTrack(session.script, "captions")?.words ?? []).length}.`;
        return matches.slice(0, 8).map((m) => `words ${m.fromIndex}-${m.toIndex} at ${fmtSec(m.startMs)}-${fmtSec(m.endMs)}s: "${m.text}"`).join("\n");
      },
    }),
    betaZodTool({
      name: "trim_clip",
      description: "Change a clip's source in/out points (source milliseconds). Later clips ripple to stay contiguous. Use for 'start a bit later', 'cut the end of that clip'.",
      strict: true,
      inputSchema: z.object({ clipId: z.string(), inMs: z.number().nullable().describe("new source in point or null to keep"), outMs: z.number().nullable().describe("new source out point or null to keep") }),
      run: ({ clipId, inMs, outMs }) => {
        count();
        session.apply({ op: "trimClip", clipId, inMs: inMs === null ? undefined : Math.round(inMs), outMs: outMs === null ? undefined : Math.round(outMs) }, `trimmed clip ${clipId}`);
        normalizeEnds(session.rec);
        return brief(session, `Trimmed ${clipId}.`);
      },
    }),
    betaZodTool({
      name: "remove_range",
      description: "Remove everything between two OUTPUT times (ms) from the main track; captions, graphics and SFX inside are dropped and later content shifts left. Use for 'remove from 0:12 to 0:15' or after find_in_transcript.",
      strict: true,
      inputSchema: z.object({ startMs: ms, endMs: ms }),
      run: ({ startMs, endMs }) => {
        count();
        session.apply({ op: "removeRange", startMs: Math.round(startMs), endMs: Math.round(endMs) }, `removed ${fmtSec(startMs)}-${fmtSec(endMs)}s`);
        normalizeEnds(session.rec);
        return brief(session, `Removed ${fmtSec(startMs)}-${fmtSec(endMs)}s.`);
      },
    }),
    betaZodTool({
      name: "delete_clip",
      description: "Delete a whole main-track clip (later clips ripple left).",
      strict: true,
      inputSchema: z.object({ clipId: z.string() }),
      run: ({ clipId }) => {
        count();
        session.apply({ op: "deleteClip", clipId }, `deleted clip ${clipId}`);
        normalizeEnds(session.rec);
        return brief(session, `Deleted ${clipId}.`);
      },
    }),
    betaZodTool({
      name: "split_clip",
      description: "Split a clip at an OUTPUT time (ms) into two clips, e.g. to punch in on only the second half.",
      strict: true,
      inputSchema: z.object({ clipId: z.string(), atMs: ms }),
      run: ({ clipId, atMs }) => {
        count();
        session.apply({ op: "splitClip", clipId, atMs: Math.round(atMs) }, `split clip ${clipId}`);
        return brief(session, `Split ${clipId} at ${fmtSec(atMs)}s.\n${describeClips(session.script)}`);
      },
    }),
    betaZodTool({
      name: "set_speed",
      description: "Set playback speed of one clip or 'all' main clips (1 = normal, 1.1 to 1.25 for a subtle talking speed-up, 2 for time-lapse).",
      strict: true,
      inputSchema: z.object({ clipId: z.string().describe("clip id or 'all'"), speed: z.number() }),
      run: ({ clipId, speed }) => {
        count();
        const sp = Math.min(4, Math.max(0.25, speed));
        const ids = clipId === "all" ? mainClips(session.script).map((c) => c.id) : [clipId];
        for (const id of ids) session.apply({ op: "setClipSpeed", clipId: id, speed: sp });
        session.log.push(`set speed ${sp}x on ${ids.length} clip${ids.length === 1 ? "" : "s"}`);
        normalizeEnds(session.rec);
        return brief(session, `Speed ${sp}x on ${ids.length} clip(s).`);
      },
    }),
    betaZodTool({
      name: "punch_in",
      description: "Set the zoom (scale) and framing offset of a clip or 'all' clips. 1 = full frame, 1.1 to 1.15 = punch-in. Use 'alternate' as clipId to alternate 1.0/1.12 across all clips.",
      strict: true,
      inputSchema: z.object({ clipId: z.string().describe("clip id, 'all' or 'alternate'"), scale: z.number(), x: z.number().nullable().describe("horizontal offset in output pixels, null for 0"), y: z.number().nullable() }),
      run: ({ clipId, scale, x, y }) => {
        count();
        const sc = Math.min(2, Math.max(0.5, scale));
        const clips = mainClips(session.script);
        if (clipId === "alternate") {
          clips.forEach((c, i) => session.apply({ op: "setClipTransform", clipId: c.id, transform: { scale: i % 2 === 1 ? sc : 1, x: 0, y: 0 } }));
          session.log.push(`alternating punch-ins at ${Math.round(sc * 100)}%`);
          return brief(session, `Alternating 100%/${Math.round(sc * 100)}% across ${clips.length} clips.`);
        }
        const ids = clipId === "all" ? clips.map((c) => c.id) : [clipId];
        for (const id of ids) session.apply({ op: "setClipTransform", clipId: id, transform: { scale: sc, x: x ?? 0, y: y ?? 0 } });
        session.log.push(`set scale ${sc} on ${ids.length} clip(s)`);
        return brief(session, `Scale ${sc} on ${ids.length} clip(s).`);
      },
    }),
    betaZodTool({
      name: "add_effect",
      description: "Add (or replace) an effect on a clip or 'all' clips: colorGrade{preset}, grain{amount}, vignette{amount}, blur{px}, lightLeak{intensity}, shake{intensity}, zoomPulse{amount,bpm}, speedRamp{from,to}. Use remove=true to remove that effect type instead.",
      strict: true,
      inputSchema: z.object({
        clipId: z.string(),
        type: z.enum(EFFECT_TYPES),
        remove: z.boolean(),
        amount: z.number().nullable(),
        preset: z.enum(COLOR_PRESETS).nullable(),
        px: z.number().nullable(),
        intensity: z.number().nullable(),
        bpm: z.number().nullable(),
        from: z.number().nullable(),
        to: z.number().nullable(),
      }),
      run: (input) => {
        count();
        const ids = input.clipId === "all" ? mainClips(session.script).map((c) => c.id) : [input.clipId];
        const params: Record<string, string | number | boolean> = {};
        if (input.amount !== null) params.amount = input.amount;
        if (input.preset !== null) params.preset = input.preset;
        if (input.px !== null) params.px = input.px;
        if (input.intensity !== null) params.intensity = input.intensity;
        if (input.bpm !== null) params.bpm = input.bpm;
        if (input.from !== null) params.from = input.from;
        if (input.to !== null) params.to = input.to;
        for (const id of ids) {
          if (input.remove) session.apply({ op: "removeEffect", clipId: id, effectType: input.type });
          else session.apply({ op: "addEffect", clipId: id, effect: { type: input.type, params } });
        }
        session.log.push(`${input.remove ? "removed" : "added"} ${input.type} on ${ids.length} clip(s)`);
        return brief(session, `${input.remove ? "Removed" : "Added"} ${input.type} on ${ids.length} clip(s).`);
      },
    }),
    betaZodTool({
      name: "set_transition",
      description: "Set the incoming transition of a clip, or of 'all' clips except the first. type null removes it (hard cut).",
      strict: true,
      inputSchema: z.object({ clipId: z.string().describe("clip id or 'all'"), type: z.enum(TRANSITION_TYPES).nullable(), durationMs: z.number().nullable() }),
      run: ({ clipId, type, durationMs }) => {
        count();
        const clips = mainClips(session.script);
        const ids = clipId === "all" ? clips.slice(1).map((c) => c.id) : [clipId];
        for (const id of ids) session.apply({ op: "setTransition", clipId: id, side: "in", transition: type ? { type, durationMs: Math.round(durationMs ?? 300) } : null });
        session.log.push(type ? `${type} transitions on ${ids.length} clip(s)` : `removed transitions on ${ids.length} clip(s)`);
        return brief(session, `${type ?? "hard cut"} on ${ids.length} clip(s).`);
      },
    }),
    betaZodTool({
      name: "set_caption_style",
      description: "Switch the caption style preset (also applies that style's default settings). Call set_caption_settings afterwards for size/colour tweaks.",
      strict: true,
      inputSchema: z.object({ style: z.enum(CAPTION_STYLE_IDS) }),
      run: ({ style }) => {
        count();
        session.apply({ op: "setCaptionStyle", style });
        session.apply({ op: "setCaptionSettings", settings: CaptionSettingsSchema.parse(captionSettingsFor(style, {}, session.script.meta.platform ?? "custom")) }, `captions switched to ${style}`);
        return brief(session, `Captions now ${style}.`);
      },
    }),
    betaZodTool({
      name: "set_caption_settings",
      description: "Adjust caption settings; null leaves a field unchanged. fontSize in px (default 64, 'bigger' ≈ +25%), position top|center|bottom, colours as hex, uppercase, emoji on/off, maxWordsPerLine, mode word|line, animation pop|fade|slide|none.",
      strict: true,
      inputSchema: z.object({
        fontSize: z.number().nullable(),
        position: z.enum(["top", "center", "bottom"]).nullable(),
        offset: z.number().nullable(),
        color: z.string().nullable(),
        highlightColor: z.string().nullable(),
        fontFamily: z.string().nullable(),
        uppercase: z.boolean().nullable(),
        emoji: z.boolean().nullable(),
        maxWordsPerLine: z.number().nullable(),
        mode: z.enum(["word", "line"]).nullable(),
        animation: z.enum(["pop", "fade", "slide", "none"]).nullable(),
      }),
      run: (input) => {
        count();
        const settings = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== null)) as Record<string, unknown>;
        if (typeof settings.maxWordsPerLine === "number") settings.maxWordsPerLine = Math.max(1, Math.round(settings.maxWordsPerLine));
        session.apply(captionSettingsOp(session.script, settings), `caption settings ${JSON.stringify(settings)}`);
        return brief(session, `Caption settings: ${JSON.stringify(getTrack(session.script, "captions")?.settings)}`);
      },
    }),
    betaZodTool({
      name: "set_captions_enabled",
      description: "Turn captions on or off.",
      strict: true,
      inputSchema: z.object({ enabled: z.boolean() }),
      run: ({ enabled }) => {
        count();
        session.apply({ op: "setCaptionsEnabled", enabled }, `captions ${enabled ? "on" : "off"}`);
        return brief(session, `Captions ${enabled ? "on" : "off"}.`);
      },
    }),
    betaZodTool({
      name: "fix_word",
      description: "Replace the text of one caption word by index (from find_in_transcript). Use for misheard names and brand words.",
      strict: true,
      inputSchema: z.object({ wordIndex: z.number(), text: z.string() }),
      run: ({ wordIndex, text }) => {
        count();
        session.apply({ op: "replaceWordText", wordIndex: Math.round(wordIndex), text }, `fixed word ${wordIndex} → "${text}"`);
        return brief(session, `Word ${wordIndex} is now "${text}".`);
      },
    }),
    betaZodTool({
      name: "add_graphic",
      description: `Add a graphic component at an OUTPUT time. propsJson is a JSON object string with the component's props (see catalogue). Components: ${GRAPHIC_COMPONENT_IDS.join(", ")}. durationMs null uses the component default.`,
      strict: true,
      inputSchema: z.object({ component: z.enum(GRAPHIC_COMPONENT_IDS), startMs: ms, durationMs: z.number().nullable(), propsJson: z.string().describe("JSON object string, e.g. {\"text\":\"Three mistakes\"}"), reason: z.string().nullable() }),
      run: ({ component, startMs, durationMs, propsJson, reason }) => {
        count();
        const info = COMPONENT_CATALOG.find((c) => c.id === component);
        const props = parseJsonObject(propsJson);
        const dur = durationMs !== null ? Math.max(0, Math.round(durationMs)) : info?.defaultDurationMs || session.script.output.durationMs;
        const id = `gfx_${component.toLowerCase()}_${Date.now().toString(36)}`;
        const item = GraphicItemSchema.parse({ id, component, startMs: Math.round(startMs), durationMs: dur, props, reason: reason ?? undefined });
        session.apply({ op: "addGraphic", item }, `added ${component}`);
        return brief(session, `Added ${component} ${id} at ${fmtSec(startMs)}s for ${fmtSec(dur)}s.`);
      },
    }),
    betaZodTool({
      name: "update_graphic",
      description: "Change a graphic's timing and/or props (propsJson merges into existing props). Use to reword a title or move an end card.",
      strict: true,
      inputSchema: z.object({ itemId: z.string(), startMs: z.number().nullable(), durationMs: z.number().nullable(), propsJson: z.string().nullable() }),
      run: ({ itemId, startMs, durationMs, propsJson }) => {
        count();
        const patch: { startMs?: number; durationMs?: number; props?: Record<string, unknown> } = {};
        if (startMs !== null) patch.startMs = Math.round(startMs);
        if (durationMs !== null) patch.durationMs = Math.round(durationMs);
        if (propsJson !== null) patch.props = parseJsonObject(propsJson);
        session.apply({ op: "updateGraphic", itemId, patch }, `updated graphic ${itemId}`);
        return brief(session, `Updated ${itemId}.`);
      },
    }),
    betaZodTool({
      name: "delete_graphic",
      description: "Remove a graphic by id.",
      strict: true,
      inputSchema: z.object({ itemId: z.string() }),
      run: ({ itemId }) => {
        count();
        session.apply({ op: "deleteGraphic", itemId }, `removed graphic ${itemId}`);
        return brief(session, `Removed ${itemId}.`);
      },
    }),
    betaZodTool({
      name: "set_color_preset",
      description: "Set the global colour preset, optionally grain and vignette (0-1, null to keep).",
      strict: true,
      inputSchema: z.object({ preset: z.enum(COLOR_PRESETS), grain: z.number().nullable(), vignette: z.number().nullable() }),
      run: ({ preset, grain, vignette }) => {
        count();
        session.apply({ op: "setColorPreset", preset }, `colour ${preset}`);
        const patch: { grain?: number; vignette?: number } = {};
        if (grain !== null) patch.grain = Math.min(1, Math.max(0, grain));
        if (vignette !== null) patch.vignette = Math.min(1, Math.max(0, vignette));
        if (Object.keys(patch).length) session.apply({ op: "setGlobal", patch });
        return brief(session, `Colour preset ${preset}.`);
      },
    }),
    betaZodTool({
      name: "set_music",
      description: "Replace the music bed with a track of the given mood ('none' removes music). gainDb null keeps -18 under speech / -12 for montages. Use for 'swap music to cinematic', 'remove the music', 'music quieter' (pass the same mood with a lower gain).",
      strict: true,
      inputSchema: z.object({ mood: z.enum([...MUSIC_MOODS, "none"]), gainDb: z.number().nullable(), ducking: z.boolean().nullable() }),
      run: async ({ mood, gainDb, ducking }) => {
        count();
        if (mood === "none") {
          let n = 0;
          for (const t of session.script.tracks) if (t.kind === "audio" && t.role === "music") for (const c of [...t.clips]) (session.apply({ op: "deleteAudioClip", clipId: c.id }), n++);
          session.log.push("removed music");
          return brief(session, `Removed ${n} music clip(s).`);
        }
        const existing = getTrack(session.script, "audio", (t) => t.role === "music")?.clips[0];
        const hasSpeech = (getTrack(session.script, "captions")?.words.length ?? 0) > 0;
        const gain = gainDb ?? existing?.gainDb ?? (hasSpeech ? -18 : -12);
        const asset = await setMusic(session.rec, session.media, session.ctx.projectId, mood, gain, ducking ?? existing?.ducking ?? hasSpeech);
        if (!asset) throw new Error("Music library unavailable right now.");
        session.log.push(`music → ${mood} at ${gain} dB`);
        return brief(session, `Music is now ${mood} (${asset.name ?? asset.id}) at ${gain} dB.`);
      },
    }),
    betaZodTool({
      name: "adjust_music",
      description: "Change the gain (dB), ducking or fades of the existing music without replacing the track.",
      strict: true,
      inputSchema: z.object({ gainDb: z.number().nullable(), ducking: z.boolean().nullable(), fadeInMs: z.number().nullable(), fadeOutMs: z.number().nullable() }),
      run: (input) => {
        count();
        const music = getTrack(session.script, "audio", (t) => t.role === "music");
        if (!music?.clips.length) throw new Error("There is no music to adjust; use set_music to add some.");
        const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== null)) as { gainDb?: number; ducking?: boolean; fadeInMs?: number; fadeOutMs?: number };
        for (const c of music.clips) session.apply(audioClipPatchOp(c, patch));
        session.log.push(`music adjusted ${JSON.stringify(patch)}`);
        return brief(session, `Music adjusted: ${JSON.stringify(patch)}.`);
      },
    }),
    betaZodTool({
      name: "add_sfx",
      description: `Add one sound effect at an OUTPUT time. Ids: ${SFX_LIBRARY.map((s) => s.id).join(", ")}. Keep SFX rare (one every 4-6 s at most).`,
      strict: true,
      inputSchema: z.object({ sfxId: z.string(), atMs: ms, reason: z.string().nullable() }),
      run: async ({ sfxId, atMs, reason }) => {
        count();
        if (!SFX_LIBRARY.some((s) => s.id === sfxId)) throw new Error(`Unknown sfxId ${sfxId}`);
        const ok = await addSfx(session.rec, session.media, session.ctx.projectId, sfxId, atMs, reason ?? "Added on request", new Map());
        if (!ok) throw new Error("SFX library unavailable right now.");
        session.log.push(`added ${sfxId} at ${fmtSec(atMs)}s`);
        return brief(session, `Added ${sfxId} at ${fmtSec(atMs)}s.`);
      },
    }),
    betaZodTool({
      name: "remove_sfx",
      description: "Remove all sound effects, or one by clip id.",
      strict: true,
      inputSchema: z.object({ clipId: z.string().nullable().describe("sfx clip id or null for all") }),
      run: ({ clipId }) => {
        count();
        let n = 0;
        for (const t of session.script.tracks) if (t.kind === "audio" && t.role === "sfx") for (const c of [...t.clips]) if (!clipId || c.id === clipId) (session.apply({ op: "deleteAudioClip", clipId: c.id }), n++);
        session.log.push(`removed ${n} sfx`);
        return brief(session, `Removed ${n} SFX clip(s).`);
      },
    }),
    betaZodTool({
      name: "add_broll",
      description: "Search stock footage and overlay it on the b-roll layer at an OUTPUT time for durationMs (3000-4000 typical). query should be the concrete nouns being said (e.g. 'laptop dashboard').",
      strict: true,
      inputSchema: z.object({ query: z.string(), atMs: ms, durationMs: z.number(), reason: z.string().nullable() }),
      run: async ({ query, atMs, durationMs, reason }) => {
        count();
        const ok = await addBroll(session.rec, session.media, session.ctx.projectId, query, atMs, Math.max(1000, Math.round(durationMs)), session.script.meta.aspect ?? "9:16", reason ?? `B-roll of "${query}"`);
        if (!ok) throw new Error(`No stock footage found for "${query}". Try a more generic query.`);
        session.log.push(`b-roll "${query}" at ${fmtSec(atMs)}s`);
        return brief(session, `Added b-roll "${query}" at ${fmtSec(atMs)}s for ${fmtSec(durationMs)}s.`);
      },
    }),
    betaZodTool({
      name: "remove_broll",
      description: "Remove all b-roll overlays, or one by clip id.",
      strict: true,
      inputSchema: z.object({ clipId: z.string().nullable() }),
      run: ({ clipId }) => {
        count();
        let n = 0;
        for (const t of session.script.tracks) if (t.kind === "video" && t.layer > 0) for (const c of [...t.clips]) if (!clipId || c.id === clipId) (session.apply({ op: "deleteClip", clipId: c.id }), n++);
        session.log.push(`removed ${n} b-roll`);
        return brief(session, `Removed ${n} b-roll clip(s).`);
      },
    }),
    betaZodTool({
      name: "set_length",
      description: "Trim the edit to a target length (ms) by dropping the least valuable clips (fewest words per second; the opening hook is kept) and trimming the tail. Use for 'make it shorter', 'make a 15 s cut'.",
      strict: true,
      inputSchema: z.object({ targetMs: z.number() }),
      run: ({ targetMs }) => {
        count();
        const before = session.script.output.durationMs;
        const r = trimScriptToTarget(session.rec, Math.max(1000, Math.round(targetMs)));
        session.log.push(`trimmed to ${fmtSec(session.script.output.durationMs)}s (removed ${r.removed} clips)`);
        return brief(session, `Was ${fmtSec(before)}s; removed ${r.removed} clip(s)${r.trimmedTail ? " and trimmed the tail" : ""}.`);
      },
    }),
    betaZodTool({
      name: "mute_footage",
      description: "Set the volume of the footage audio on all main clips (0 mutes, 1 normal).",
      strict: true,
      inputSchema: z.object({ volume: z.number() }),
      run: ({ volume }) => {
        count();
        const v = Math.min(2, Math.max(0, volume));
        for (const c of mainClips(session.script)) session.apply({ op: "setClipVolume", clipId: c.id, volume: v });
        session.log.push(v === 0 ? "muted footage audio" : `footage volume ${v}`);
        return brief(session, `Footage volume ${v}.`);
      },
    }),
    betaZodTool({
      name: "set_title",
      description: "Set the project title shown in the UI and used by titles (meta.title).",
      strict: true,
      inputSchema: z.object({ title: z.string() }),
      run: ({ title }) => {
        count();
        session.apply({ op: "setMeta", patch: { title } }, `title "${title}"`);
        return brief(session, `Title set.`);
      },
    }),
    betaZodTool({
      name: "finish",
      description: "ALWAYS call this last, once, when the edit is done (or when nothing should change). summary: what changed in plain words; message: one or two friendly sentences for the chat; suggestions: 3-4 short follow-up chips.",
      strict: true,
      inputSchema: z.object({ summary: z.string(), message: z.string(), suggestions: z.array(z.string()) }),
      run: ({ summary, message, suggestions }) => {
        count();
        session.finish = { summary: summary.trim(), message: message.trim(), suggestions: suggestions.map((s) => s.trim()).filter(Boolean).slice(0, 4) };
        return "Recorded. Stop here.";
      },
    }),
  ];
  return tools;
}

/* ------------------------------------------------------------------ */
/* Phrase search over caption words                                     */
/* ------------------------------------------------------------------ */

export interface PhraseMatch {
  fromIndex: number;
  toIndex: number;
  startMs: number;
  endMs: number;
  text: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function findPhrase(script: EditScript, query: string): PhraseMatch[] {
  const words = getTrack(script, "captions")?.words ?? [];
  const q = query.split(/\s+/).map(norm).filter(Boolean);
  if (!q.length || !words.length) return [];
  const out: PhraseMatch[] = [];
  for (let i = 0; i + q.length <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < q.length; j++) {
      const w = norm(words[i + j]!.text);
      if (w !== q[j] && !(q[j]!.length >= 4 && w.startsWith(q[j]!))) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const last = words[i + q.length - 1]!;
      out.push({ fromIndex: i, toIndex: i + q.length - 1, startMs: words[i]!.t, endMs: last.t + last.d, text: words.slice(i, i + q.length).map((w) => w.text).join(" ") });
    }
  }
  if (!out.length && q.length > 1) {
    // Fuzzy: any 2 consecutive query words.
    for (let k = 0; k + 1 < q.length; k++) out.push(...findPhrase(script, `${q[k]} ${q[k + 1]}`));
  }
  return out;
}

