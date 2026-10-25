/**
 * editScript: conversational edits.
 * Claude mode: Opus 5.5 via the SDK tool runner with the ops tool set (effort medium, max 25 iterations).
 * MOCK mode (or API failure): a rule-based interpreter that handles the common instructions by keywords.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { env } from "@vibe/core";
import { CAPTION_STYLE_IDS, COLOR_PRESETS, MUSIC_MOODS, TRANSITION_TYPES, clipDuration, getTrack, mainClips, type EditScript, type TransitionType } from "@vibe/edl";
import type { ChatTurn, EditResult, MediaProvider, ProjectContext } from "./types";
import { BETAS, FALLBACKS, getClient, stopIssue, systemBlocks, textOf, warn } from "./client";
import { buildManifest, fmtSec } from "./manifest";
import { EditSession, describeScriptState, findPhrase, makeTools } from "./tools";
import { addBroll, addSfx, brollQuery, capitalize, captionSettingsFor, normalizeEnds, setMusic, trimScriptToTarget, truncate } from "./builder";
import { selfCheckSync } from "./check";
import { quickSuggestions } from "./suggestions";
import { COLOR_ALIASES, COLOR_NAMES, MOOD_ALIASES, STYLE_ALIASES, findAlias, parseDurationMs, parseTimestamp, quoted } from "./lexicon";

export async function editScript(ctx: ProjectContext, script: EditScript, instruction: string, history: ChatTurn[], media: MediaProvider): Promise<EditResult> {
  if (env.mockAi) return mockEdit(ctx, script, instruction, history, media);
  try {
    return await claudeEdit(ctx, script, instruction, history, media);
  } catch (e) {
    warn("edit", e);
    const r = await mockEdit(ctx, script, instruction, history, media);
    return { ...r, message: `The model was unavailable, so I applied this with the built-in editor. ${r.message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Claude                                                              */
/* ------------------------------------------------------------------ */

export function historyToMessages(history: ChatTurn[], max = 12): Anthropic.Beta.BetaMessageParam[] {
  return history
    .slice(-max)
    .filter((h) => h.content && h.content.trim())
    .map((h) => ({ role: h.role, content: h.content.trim() }));
}

async function claudeEdit(ctx: ProjectContext, script: EditScript, instruction: string, history: ChatTurn[], media: MediaProvider): Promise<EditResult> {
  const client = getClient();
  const session = new EditSession(ctx, script, media);
  const tools = makeTools(session);
  const manifest = buildManifest(ctx, { budgetTokens: 12_000 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    // Stable per project → third cache breakpoint (system has two).
    { role: "user", content: [{ type: "text", text: `FOOTAGE MANIFEST (source times, for reference):\n${manifest}`, cache_control: { type: "ephemeral" } }] },
    { role: "assistant", content: "Got it. I have the footage manifest. I will apply each instruction with the tools, verify the result, and call finish." },
    ...historyToMessages(history),
    {
      role: "user",
      content: [
        { type: "text", text: `CURRENT SCRIPT STATE:\n${describeScriptState(script)}` },
        { type: "text", text: `INSTRUCTION:\n${instruction.trim()}\n\nApply it with the tools, check the returned state, then call finish.` },
      ],
    },
  ];
  const runner = client.beta.messages.toolRunner({
    model: env.agentModel,
    max_tokens: 16_000,
    max_iterations: 25,
    betas: BETAS,
    fallbacks: FALLBACKS,
    output_config: { effort: "medium" },
    system: systemBlocks(ctx, "edit"),
    tools,
    messages,
  });
  let last: Anthropic.Beta.BetaMessage | undefined;
  let issue: string | null = null;
  for await (const message of runner) {
    last = message;
    issue = stopIssue(message);
    if (issue) break; // a refusal can cut a tool_use off mid-input: never run that turn's tools
    await runner.generateToolResponse(); // run the tools now (cached: not re-run by the runner)
    if (session.finish) break;
  }
  const ops = [...session.ops];
  let summary = session.finish?.summary ?? (session.log.length ? capitalize(session.log.join(", ")) + "." : "No changes made.");
  let message = session.finish?.message ?? textOf(last) ?? summary;
  if (issue) message = `${issue} ${session.log.length ? `I applied these changes before stopping: ${session.log.join(", ")}.` : "Nothing was changed."}`;
  const check = selfCheckSync(session.script, ctx);
  ops.push(...check.ops);
  if (check.fixed.length) summary += ` Also ${check.fixed.join(", ")}.`;
  return { script: check.script, ops, summary, message, suggestions: session.finish?.suggestions?.length ? session.finish.suggestions : quickSuggestions(check.script), checks: check.checks };
}

/* ------------------------------------------------------------------ */
/* Rule-based interpreter (MOCK mode / fallback)                       */
/* ------------------------------------------------------------------ */

const CLIP_ORDINALS: Record<string, number> = { first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2, fourth: 3, fifth: 4, last: -1, opening: 0, intro: 0 };

export async function mockEdit(ctx: ProjectContext, script: EditScript, instruction: string, _history: ChatTurn[], media: MediaProvider): Promise<EditResult> {
  const session = new EditSession(ctx, script, media);
  const text = instruction.trim();
  const l = text.toLowerCase();
  const did: string[] = [];
  const notes: string[] = [];
  const s = () => session.script;
  const hasSpeech = () => (getTrack(s(), "captions")?.words.length ?? 0) > 0;
  const platform = s().meta.platform ?? "custom";
  const colorsInText = Object.keys(COLOR_NAMES).filter((c) => new RegExp(`\\b${c}\\b`).test(l));
  const negated = (what: RegExp) => new RegExp(`\\b(remove|delete|no|without|kill|drop|get rid of|turn off|disable|hide|take out|lose|ditch|mute|off)\\b[^.]{0,24}${what.source}|${what.source}[^.]{0,12}\\b(off|out|away|gone)\\b`, "i").test(l);

  // 0. Undo-like requests: explain, do nothing.
  if (/\b(undo|revert|go back|roll ?back|previous version|restore the (last|previous)|cancel that)\b/.test(l)) {
    return finish(session, [], "Undo lives in the version list: every edit is a checkpoint, so pick the one you want to go back to, or tell me precisely what to change and I'll do it.", ctx);
  }

  // 1. Music
  if (/\b(music|track|soundtrack|song|bed|beat|tune)\b/.test(l) && !/\bsound ?track of the footage\b/.test(l)) {
    const musicClips = () => getTrack(s(), "audio", (t) => t.role === "music")?.clips ?? [];
    if (negated(/\b(music|track|soundtrack|song|bed|beat|tune)\b/)) {
      if (musicClips().length) {
        for (const c of [...musicClips()]) session.apply({ op: "deleteAudioClip", clipId: c.id });
        did.push("removed the music");
      } else notes.push("There was no music to remove.");
    } else if (/\b(quieter|lower|softer|down|too loud|less loud|reduce)\b/.test(l) && musicClips().length) {
      for (const c of musicClips()) session.apply({ op: "updateAudioClip", clipId: c.id, patch: { gainDb: Math.max(-40, c.gainDb - 4), ducking: true } });
      did.push("turned the music down 4 dB");
    } else if (/\b(louder|up|more|boost|higher)\b/.test(l) && musicClips().length && !findAlias(l, MOOD_ALIASES, MUSIC_MOODS)) {
      for (const c of musicClips()) session.apply({ op: "updateAudioClip", clipId: c.id, patch: { gainDb: Math.min(-6, c.gainDb + 4) } });
      did.push("turned the music up 4 dB");
    } else {
      const mood = findAlias(l, MOOD_ALIASES, MUSIC_MOODS) ?? (/\b(add|put|some|with)\b/.test(l) && !musicClips().length ? (hasSpeech() ? "lofi" : "energetic") : undefined);
      if (mood) {
        const existing = musicClips()[0];
        const asset = await setMusic(session.rec, media, ctx.projectId, mood, existing?.gainDb ?? (hasSpeech() ? -18 : -12), existing?.ducking ?? hasSpeech());
        if (asset) did.push(existing ? `swapped the music to a ${mood} track` : `added a ${mood} track`);
        else notes.push("The music library is unavailable right now.");
      }
    }
  }

  // 2. Captions
  const mentionsCaptions = /\b(captions?|subtitles?|subs|caption text|words on screen)\b/.test(l);
  const styleHit = findAlias(l, STYLE_ALIASES, CAPTION_STYLE_IDS);
  if (mentionsCaptions || (styleHit && /\b(style|captions?|font|text|switch|change|try|use)\b/.test(l) && !/\btitle\b/.test(l))) {
    const settings: Record<string, unknown> = {};
    const caps = getTrack(s(), "captions");
    if (mentionsCaptions && negated(/\b(captions?|subtitles?|subs)\b/) && !/\b(bigger|smaller|colou?r|white|yellow|style)\b/.test(l)) {
      session.apply({ op: "setCaptionsEnabled", enabled: false });
      did.push("turned captions off");
    } else {
      if (mentionsCaptions && /\b(turn on|enable|show|back on|add)\b/.test(l) && caps && !caps.enabled) {
        session.apply({ op: "setCaptionsEnabled", enabled: true });
        did.push("turned captions on");
      }
      if (styleHit && styleHit !== caps?.style) {
        session.apply({ op: "setCaptionStyle", style: styleHit });
        session.apply({ op: "setCaptionSettings", settings: captionSettingsFor(styleHit, {}, platform) });
        did.push(`switched captions to ${styleHit.replace("-", " ")}`);
      }
      const cur = getTrack(s(), "captions")?.settings;
      const sizeMatch = l.match(/\b(?:size|font)\s*(?:of\s*)?(\d{2,3})\b/);
      if (sizeMatch) settings.fontSize = Number(sizeMatch[1]);
      else if (/\b(bigger|larger|huge|big|massive|increase|more visible)\b/.test(l)) settings.fontSize = Math.round((cur?.fontSize ?? 64) * (/\b(much|way|a lot)\b/.test(l) ? 1.5 : 1.25));
      else if (/\b(smaller|tiny|small|reduce|decrease|less)\b/.test(l) && mentionsCaptions) settings.fontSize = Math.round((cur?.fontSize ?? 64) * 0.8);
      if (colorsInText.length) {
        if (/\bhighlight/.test(l)) settings.highlightColor = COLOR_NAMES[colorsInText[0]!];
        else {
          settings.color = COLOR_NAMES[colorsInText[0]!];
          if (colorsInText[1]) settings.highlightColor = COLOR_NAMES[colorsInText[1]!];
        }
      }
      if (/\b(at the |to the |on )?(top|higher|up)\b/.test(l) && mentionsCaptions) settings.position = "top";
      else if (/\b(bottom|lower|down)\b/.test(l) && mentionsCaptions && !/\blower[- ]third\b/.test(l)) settings.position = "bottom";
      else if (/\b(cent(er|re)|middle)\b/.test(l) && mentionsCaptions) settings.position = "center";
      if (/\b(uppercase|all caps|capitals)\b/.test(l)) settings.uppercase = true;
      else if (/\b(lowercase|sentence case|no caps)\b/.test(l)) settings.uppercase = false;
      if (/\bemoji/.test(l)) settings.emoji = !/\b(no|without|remove)\b[^.]{0,10}emoji/.test(l);
      const wpl = l.match(/(\d)\s*words?\s*(per|a|each)\s*(line|group|time)/);
      if (wpl) settings.maxWordsPerLine = Number(wpl[1]);
      else if (/\bone word at a time\b/.test(l)) settings.mode = "word";
      else if (/\b(full lines?|whole sentences?|line by line)\b/.test(l)) settings.mode = "line";
      if (Object.keys(settings).length) {
        session.apply({ op: "setCaptionSettings", settings });
        const bits: string[] = [];
        if (settings.fontSize) bits.push(`size ${settings.fontSize}`);
        if (settings.color) bits.push(`${colorsInText[0]} text`);
        if (settings.highlightColor) bits.push(`${colorsInText[/\bhighlight/.test(l) ? 0 : 1]} highlight`);
        if (settings.position) bits.push(`${settings.position} position`);
        if (settings.uppercase !== undefined) bits.push(settings.uppercase ? "uppercase" : "sentence case");
        if (settings.emoji !== undefined) bits.push(settings.emoji ? "emoji on" : "emoji off");
        if (settings.maxWordsPerLine) bits.push(`${settings.maxWordsPerLine} words per line`);
        if (settings.mode) bits.push(`${settings.mode} mode`);
        did.push(`captions: ${bits.join(", ")}`);
      }
    }
  }

  // 3. Title / hook text
  const gfx = () => getTrack(s(), "graphics")?.items ?? [];
  if (/\b(title|headline|hook (text|title|card)|text card)\b/.test(l) && !/\blower[- ]third\b/.test(l)) {
    const existing = gfx().find((g) => g.component === "KineticTitle");
    if (negated(/\b(title|headline)\b/)) {
      if (existing) {
        session.apply({ op: "deleteGraphic", itemId: existing.id });
        did.push("removed the title");
      } else notes.push("There is no title to remove.");
    } else {
      const captured = quoted(text) ?? text.match(/\b(?:says?|saying|reads?|reading|with the text|text|to)\s*[:\-]?\s*(.{2,60})$/i)?.[1]?.replace(/[.!]+$/, "").trim();
      const words = getTrack(s(), "captions")?.words ?? [];
      const titleText = captured ?? (words.length ? capitalize(words.slice(0, 5).map((w) => w.text).join(" ").replace(/[.,;:!?]+$/, "")) : s().meta.title ?? "Watch this");
      if (existing && (/\b(change|rename|edit|reword|update|make the title|set the title)\b/.test(l) || captured)) {
        session.apply({ op: "updateGraphic", itemId: existing.id, patch: { props: { text: titleText } } });
        did.push(`changed the title to "${titleText}"`);
      } else if (!existing) {
        session.apply({ op: "addGraphic", item: { component: "KineticTitle", startMs: 0, durationMs: 2500, props: { text: titleText, align: hasSpeech() ? "top" : "center", style: "slam" }, reason: "Title added on request" } });
        did.push(`added the title "${titleText}"`);
      } else notes.push(`There is already a title ("${String(existing.props.text ?? "")}"); tell me the new wording to change it.`);
    }
  } else if (/\badd (a |an )?hook\b/.test(l)) {
    const words = getTrack(s(), "captions")?.words ?? [];
    const titleText = capitalize(words.slice(0, 5).map((w) => w.text).join(" ").replace(/[.,;:!?]+$/, "")) || s().meta.title || "Watch this";
    session.apply({ op: "addGraphic", item: { component: "KineticTitle", startMs: 0, durationMs: 2500, props: { text: titleText, align: "top", style: "slam" }, reason: "Hook title added on request" } });
    did.push(`added a hook title "${titleText}"`);
  }

  // 4. End card
  if (/\b(end ?card|outro card|cta card|call to action)\b/.test(l)) {
    const existing = gfx().find((g) => g.component === "EndCard");
    if (negated(/\b(end ?card|outro|cta)\b/)) {
      if (existing) (session.apply({ op: "deleteGraphic", itemId: existing.id }), did.push("removed the end card"));
    } else if (!existing) {
      const dur = s().output.durationMs;
      const headline = quoted(text) ?? "Follow for more";
      session.apply({ op: "addGraphic", item: { component: "EndCard", startMs: Math.max(0, dur - 3000), durationMs: 3000, props: { headline, handle: ctx.brand?.handle ?? "" }, reason: "End card added on request" } });
      did.push("added an end card");
    } else if (quoted(text)) {
      session.apply({ op: "updateGraphic", itemId: existing.id, patch: { props: { headline: quoted(text) } } });
      did.push("reworded the end card");
    }
  }

  // 5. Lower third
  if (/\blower[- ]?third\b|\bmy name\b.*\b(at the start|bottom|as a)\b|\bname (tag|plate|bar)\b/.test(l)) {
    const existing = gfx().find((g) => g.component === "LowerThird");
    if (negated(/\blower[- ]?third\b/)) {
      if (existing) (session.apply({ op: "deleteGraphic", itemId: existing.id }), did.push("removed the lower third"));
    } else {
      const name = quoted(text) ?? text.match(/\b(?:name|says?|saying|with|for|reading)\s*[:\-]?\s*([A-Z][\w.&'-]*(?:\s+[A-Z][\w.&'-]*){0,3})/)?.[1] ?? ctx.brand?.handle ?? "Your name";
      const title = text.match(/\b(?:title|subtitle|role)\s*[:\-]?\s*"?([^",.]{2,40})/i)?.[1]?.trim() ?? "";
      const at = /\b(start|beginning|intro|first)\b/.test(l) ? 1500 : /\b(end|outro)\b/.test(l) ? Math.max(0, s().output.durationMs - 6000) : 2800;
      if (existing) {
        session.apply({ op: "updateGraphic", itemId: existing.id, patch: { startMs: at, props: { name, title } } });
        did.push(`updated the lower third (${name})`);
      } else {
        session.apply({ op: "addGraphic", item: { component: "LowerThird", startMs: at, durationMs: 4000, props: { name, title }, reason: "Lower third added on request" } });
        did.push(`added a lower third for ${name}`);
      }
    }
  }

  // 6. Progress bar / subscribe bubble
  if (/\bprogress bar\b/.test(l)) {
    const existing = gfx().find((g) => g.component === "ProgressBar");
    if (negated(/\bprogress bar\b/)) {
      if (existing) (session.apply({ op: "deleteGraphic", itemId: existing.id }), did.push("removed the progress bar"));
    } else if (!existing) {
      session.apply({ op: "addGraphic", item: { component: "ProgressBar", startMs: 0, durationMs: s().output.durationMs, props: { position: /\bbottom\b/.test(l) ? "bottom" : "top" }, reason: "Progress bar added on request" } });
      did.push("added a progress bar");
    }
  }
  if (/\b(subscribe|follow) (bubble|button|pill|reminder)\b/.test(l)) {
    const existing = gfx().find((g) => g.component === "SubscribeBubble");
    if (negated(/\b(bubble|button|pill|reminder)\b/)) {
      if (existing) (session.apply({ op: "deleteGraphic", itemId: existing.id }), did.push("removed the follow bubble"));
    } else if (!existing) {
      session.apply({ op: "addGraphic", item: { component: "SubscribeBubble", startMs: Math.round(s().output.durationMs * 0.45), durationMs: 2500, props: { label: /subscribe/.test(l) ? "Subscribe" : "Follow", platform: platform === "youtube" || platform === "shorts" ? "youtube" : platform === "reels" ? "instagram" : platform === "tiktok" ? "tiktok" : "generic" }, reason: "Follow nudge added on request" } });
      did.push("added a follow bubble");
    }
  }

  // 7. Remove a range / a spoken part / first-last seconds
  const rangeMatch = l.match(/\b(?:remove|cut|delete|take out|drop|trim)\b[^0-9]{0,40}?\b(?:from|between)?\s*((?:\d+:)?\d+(?:\.\d+)?\s*(?:s|sec|secs|seconds?)?)\s*(?:to|and|-|–|until|through)\s*((?:\d+:)?\d+(?:\.\d+)?\s*(?:s|sec|secs|seconds?)?)/);
  if (rangeMatch) {
    const a = parseTimestamp(rangeMatch[1]!);
    const b = parseTimestamp(rangeMatch[2]!);
    if (a !== undefined && b !== undefined && b > a && a < s().output.durationMs) {
      session.apply({ op: "removeRange", startMs: a, endMs: Math.min(b, s().output.durationMs) });
      normalizeEnds(session.rec);
      did.push(`removed ${fmtSec(a)}-${fmtSec(b)}s`);
    } else notes.push("I couldn't read that time range; try something like 'remove from 0:12 to 0:15'.");
  } else {
    const edge = l.match(/\b(?:cut|remove|trim|drop|lose|chop)\b[^.]{0,12}\b(first|last|opening|final)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)\b/);
    if (edge) {
      const n = Math.round(Number(edge[2]) * 1000);
      const dur = s().output.durationMs;
      if (edge[1] === "first" || edge[1] === "opening") session.apply({ op: "removeRange", startMs: 0, endMs: Math.min(n, dur - 1000) });
      else session.apply({ op: "removeRange", startMs: Math.max(1000, dur - n), endMs: dur });
      normalizeEnds(session.rec);
      did.push(`cut the ${edge[1]} ${edge[2]} s`);
    } else {
      const where = text.match(/\b(?:remove|cut|delete|take out|drop|lose)\b\s+(?:the\s+)?(?:part|bit|section|moment|clip|piece)?\s*(?:where|when|in which|about|with)\s+(?:i|we|he|she|they|you)?\s*(?:say|said|says|mention|mentions|talk about|talks about|cough|coughs|sneeze|laugh)?\s*(.{2,80})$/i)?.[1];
      if (where) {
        const phrase = where.replace(/["“”']/g, "").replace(/[.!?]+$/, "").trim();
        const matches = findPhrase(s(), phrase);
        if (matches.length) {
          const m = matches[0]!;
          // Expand to the surrounding sentence: nearest word gap > 400 ms on each side.
          const words = getTrack(s(), "captions")?.words ?? [];
          let from = m.fromIndex;
          while (from > 0 && words[from]!.t - (words[from - 1]!.t + words[from - 1]!.d) < 400 && !/[.!?]$/.test(words[from - 1]!.text)) from--;
          let to = m.toIndex;
          while (to + 1 < words.length && words[to + 1]!.t - (words[to]!.t + words[to]!.d) < 400 && !/[.!?]$/.test(words[to]!.text)) to++;
          const startMs = Math.max(0, words[from]!.t - 120);
          const endMs = Math.min(s().output.durationMs, words[to]!.t + words[to]!.d + 120);
          session.apply({ op: "removeRange", startMs, endMs });
          normalizeEnds(session.rec);
          did.push(`removed the part where you say "${truncate(words.slice(from, to + 1).map((w) => w.text).join(" "), 50)}" (${fmtSec(startMs)}-${fmtSec(endMs)}s)`);
        } else notes.push(`I couldn't find "${phrase}" in the transcript. Try the exact words, or give me a time range like 0:12 to 0:15.`);
      }
    }
  }

  // 8. Length / pacing / speed
  const target = parseDurationMs(l);
  const wantsShorter = /\b(shorter|shorten|tighter|tighten|trim it|cut it down|cut down|too long|condense|compress|under|max(imum)?|no longer than|down to)\b/.test(l) || /\b\d+\s*(s|sec|secs|seconds?)\s+(cut|version|edit)\b/.test(l) || (!!target && /\b(around|about|to|length|long|make it)\b/.test(l) && !rangeMatch);
  const wantsFaster = /\b(faster|quicker|snappier|punchier|speed (it )?up|more pace|pacier|more energy)\b/.test(l);
  const wantsSlower = /\b(slower|slow (it )?down|longer|more breathing room|less rushed|calmer)\b/.test(l);
  if (wantsShorter && !rangeMatch) {
    const before = s().output.durationMs;
    const goal = target && target < before ? target : Math.round(before * 0.8);
    const r = trimScriptToTarget(session.rec, goal);
    const after = s().output.durationMs;
    if (after < before) did.push(`trimmed from ${fmtSec(before)}s to ${fmtSec(after)}s${r.removed ? ` by dropping ${r.removed} weaker clip${r.removed === 1 ? "" : "s"}` : ""}`);
    else notes.push(`It's already ${fmtSec(before)}s; I can't go shorter without losing the opening line.`);
  } else if (wantsFaster) {
    const sp = l.match(/(\d(?:\.\d+)?)\s*x\b/) ? Math.min(2, Number(l.match(/(\d(?:\.\d+)?)\s*x\b/)![1])) : 1.15;
    for (const c of mainClips(s())) session.apply({ op: "setClipSpeed", clipId: c.id, speed: Math.min(2, Math.round(Math.max(c.speed, 1) * (sp / Math.max(1, c.speed)) * 100) / 100) });
    normalizeEnds(session.rec);
    did.push(`sped the footage up to ${sp}x (now ${fmtSec(s().output.durationMs)}s)`);
  } else if (wantsSlower) {
    const sped = mainClips(s()).filter((c) => c.speed > 1);
    if (sped.length) {
      for (const c of sped) session.apply({ op: "setClipSpeed", clipId: c.id, speed: 1 });
      normalizeEnds(session.rec);
      did.push("brought the footage back to normal speed");
    } else notes.push("I can't add footage that was cut out from here; restore an earlier version or tell me which part to extend.");
  } else if (/\b(\d(?:\.\d+)?)\s*x\b/.test(l) && /\b(speed|fast|time[- ]?lapse)\b/.test(l)) {
    const sp = Math.min(4, Number(l.match(/(\d(?:\.\d+)?)\s*x\b/)![1]));
    for (const c of mainClips(s())) session.apply({ op: "setClipSpeed", clipId: c.id, speed: sp });
    normalizeEnds(session.rec);
    did.push(`set speed to ${sp}x`);
  }

  // 9. Punch-ins / zoom
  if (/\b(punch[- ]?ins?|zooms?|zoom in|scale)\b/.test(l) && !/\bzoom transition\b/.test(l)) {
    const clips = mainClips(s());
    if (negated(/\b(punch[- ]?ins?|zooms?)\b/) || /\b(less|fewer) (zoom|punch)/.test(l)) {
      for (const c of clips) if (c.transform.scale !== 1) session.apply({ op: "setClipTransform", clipId: c.id, transform: { scale: 1, x: 0, y: 0 } });
      did.push("removed the punch-ins");
    } else {
      const ord = Object.keys(CLIP_ORDINALS).find((k) => new RegExp(`\\b${k}\\b`).test(l));
      const nMatch = l.match(/\bclip\s*(\d+)\b/);
      const scale = /\b(more|stronger|harder|bigger)\b/.test(l) ? 1.18 : 1.12;
      if (ord !== undefined || nMatch) {
        const idx = nMatch ? Number(nMatch[1]) - 1 : CLIP_ORDINALS[ord!]!;
        const c = clips[idx < 0 ? clips.length + idx : idx];
        if (c) (session.apply({ op: "setClipTransform", clipId: c.id, transform: { scale, x: 0, y: 0 } }), did.push(`punched in on the ${ord ?? `clip ${nMatch![1]}`} clip`));
      } else {
        clips.forEach((c, i) => session.apply({ op: "setClipTransform", clipId: c.id, transform: { scale: i % 2 === 1 ? scale : 1, x: 0, y: 0 } }));
        did.push(`alternating punch-ins at ${Math.round(scale * 100)}% across ${clips.length} clips`);
      }
    }
  }

  // 10. Colour grade
  if (/\b(grade|grading|colou?r|look|filter|lut|tone|black and white|b&w|monochrome|vibrant|warm film|moody|teal|cinematic look|vintage|desaturat)/.test(l) && !mentionsCaptions) {
    const preset = /\b(remove|no|without|reset|ungraded)\b[^.]{0,10}\b(grade|colou?r|filter|lut|look)\b/.test(l) ? "none" : findAlias(l.replace(/\b(music|track)\b[^.]*/g, ""), COLOR_ALIASES, COLOR_PRESETS);
    if (preset && preset !== s().global.colorPreset) {
      session.apply({ op: "setColorPreset", preset });
      session.apply({ op: "setGlobal", patch: { grain: preset === "warm-film" ? 0.15 : 0, vignette: preset === "moody" || preset === "teal-orange" ? 0.2 : 0 } });
      did.push(preset === "none" ? "removed the colour grade" : `applied the ${preset.replace("-", " ")} grade`);
    } else if (/\b(grain|grainy|film grain)\b/.test(l)) {
      const off = negated(/\bgrain/);
      session.apply({ op: "setGlobal", patch: { grain: off ? 0 : /\bmore\b/.test(l) ? Math.min(1, s().global.grain + 0.15) : 0.2 } });
      did.push(off ? "removed the grain" : "added film grain");
    } else if (/\bvignette\b/.test(l)) {
      const off = negated(/\bvignette/);
      session.apply({ op: "setGlobal", patch: { vignette: off ? 0 : 0.25 } });
      did.push(off ? "removed the vignette" : "added a vignette");
    }
  }

  // 11. B-roll
  if (/\bb[- ]?roll\b|\bstock (footage|clips?|video)\b|\boverlay footage\b/.test(l)) {
    const brollClips = () => s().tracks.flatMap((t) => (t.kind === "video" && t.layer > 0 ? t.clips : []));
    if (negated(/\b(b[- ]?roll|stock)\b/)) {
      for (const c of [...brollClips()]) session.apply({ op: "deleteClip", clipId: c.id });
      did.push("removed the b-roll");
    } else {
      const topic = text.match(/\b(?:of|about|showing|with|for)\s+([a-z][\w\s-]{2,40}?)(?:\s+(?:at|around|when|where|every)\b|[.,!]|$)/i)?.[1]?.trim();
      const at = l.match(/\bat\s+((?:\d+:)?\d+(?:\.\d+)?\s*(?:s|sec|seconds?)?)\b/);
      const words = getTrack(s(), "captions")?.words ?? [];
      const dur = s().output.durationMs;
      const targets: number[] = [];
      if (at && parseTimestamp(at[1]!) !== undefined) targets.push(parseTimestamp(at[1]!)!);
      else {
        // Every ~12 s of talking from 4 s in, skipping the last 4 s.
        for (let t = 4500; t + 3500 < dur - 3000 && targets.length < 6; t += 12_000) if (!brollClips().some((c) => Math.abs(c.startMs - t) < 6000)) targets.push(t);
        if (!targets.length && dur > 6000) targets.push(Math.round(dur / 2) - 1750);
      }
      let n = 0;
      for (const t of targets) {
        const q = topic ?? brollQuery(words.filter((w) => w.t >= t - 2000 && w.t < t + 5500));
        if (await addBroll(session.rec, media, ctx.projectId, q, t, 3500, s().meta.aspect ?? "9:16", `B-roll of "${q}" on request`)) n++;
      }
      if (n) did.push(`added ${n} b-roll insert${n === 1 ? "" : "s"}${topic ? ` of ${topic}` : ""}`);
      else notes.push("No stock footage came back for that; try describing the subject differently.");
    }
  }

  // 12. Mute / footage volume
  if (/\b(mute|silence|kill the audio|no audio|unmute|audio back)\b/.test(l) && !/\b(music|track|song|soundtrack)\b/.test(l)) {
    const un = /\b(unmute|audio back|turn the audio (back )?on)\b/.test(l);
    for (const c of mainClips(s())) session.apply({ op: "setClipVolume", clipId: c.id, volume: un ? 1 : 0 });
    did.push(un ? "unmuted the footage" : "muted the footage audio");
  }

  // 13. Transitions
  const transitionHit = (() => {
    if (/\bcross ?fade|dissolve\b/.test(l)) return "crossfade";
    if (/\bwhip\b/.test(l)) return "whip";
    if (/\bglitch\b/.test(l)) return "glitch";
    if (/\bflash\b/.test(l)) return "flash";
    if (/\bslide\b/.test(l) && /\btransition/.test(l)) return "slide";
    if (/\bdip to black|fade to black\b/.test(l)) return "dip-to-black";
    if (/\bzoom transition/.test(l)) return "zoom";
    return undefined;
  })() as TransitionType | undefined;
  if (transitionHit || /\b(hard cuts?|no transitions?|remove (the )?transitions?)\b/.test(l)) {
    const clips = mainClips(s()).slice(1);
    const type = transitionHit && !/\b(remove|no)\b[^.]{0,8}\b(cross ?fade|dissolve|whip|glitch|flash|slide|transitions?)\b/.test(l) ? transitionHit : null;
    for (const c of clips) session.apply({ op: "setTransition", clipId: c.id, side: "in", transition: type ? { type, durationMs: type === "crossfade" ? 400 : type === "flash" ? 150 : 250 } : null });
    did.push(type ? `${type} transitions on ${clips.length} cuts` : "switched to hard cuts");
  }

  // 14. SFX
  if (/\b(sfx|sound effects?|whoosh(es)?|swoosh|ding|impact)\b/.test(l) && !/\bsound ?track\b/.test(l)) {
    const sfxClips = () => getTrack(s(), "audio", (t) => t.role === "sfx")?.clips ?? [];
    if (negated(/\b(sfx|sound effects?|whoosh(es)?|swoosh)\b/) || /\b(fewer|less)\b/.test(l)) {
      const n = sfxClips().length;
      for (const c of [...sfxClips()]) session.apply({ op: "deleteAudioClip", clipId: c.id });
      did.push(`removed ${n} sound effect${n === 1 ? "" : "s"}`);
    } else if (/\b(add|more|put|some)\b/.test(l)) {
      const id = /\bding\b/.test(l) ? "sfx-ding" : /\bimpact|boom\b/.test(l) ? "sfx-impact" : "sfx-whoosh-1";
      const cache = new Map();
      let last = -Infinity;
      let n = 0;
      for (const c of mainClips(s()).slice(1)) {
        if (c.startMs - last < 4000 || n >= 6) continue;
        if (await addSfx(session.rec, media, ctx.projectId, id, Math.max(0, c.startMs - 60), "Added on request", cache)) (n++, (last = c.startMs));
      }
      if (n) did.push(`added ${n} ${id.replace("sfx-", "").replace(/-\d$/, "")} SFX on cuts`);
      else notes.push("The SFX library is unavailable right now.");
    }
  }

  // 15. Aspect / platform changes are not script ops we can fulfil well here.
  if (!did.length && !notes.length && /\b(9:16|16:9|1:1|4:5|vertical|landscape|square|aspect)\b/.test(l)) {
    notes.push("Changing the aspect ratio re-frames every clip, so it is done from the project settings (Aspect) and rebuilt from the plan.");
  }

  if (!did.length && !notes.length) {
    return finish(session, [], `I'm not sure how to do that yet. Try something like "make it shorter, around 20 seconds", "switch captions to Hormozi and make them bigger", "swap the music to cinematic", "remove the part where I say pricing", or "add a title that says Three mistakes".`, ctx);
  }
  const summary = did.length ? capitalize(did.join(", ")) + "." : "No changes made.";
  const message = [did.length ? `Done: ${did.join(", ")}.` : "", ...notes].filter(Boolean).join(" ");
  return finish(session, did, message, ctx, summary);
}

function finish(session: EditSession, did: string[], message: string, ctx: ProjectContext, summary?: string): EditResult {
  const check = selfCheckSync(session.script, ctx);
  const ops = [...session.ops, ...check.ops];
  const sum = summary ?? (did.length ? capitalize(did.join(", ")) + "." : "No changes made.");
  return { script: check.script, ops, summary: check.fixed.length ? `${sum} Also ${check.fixed.join(", ")}.` : sum, message, suggestions: quickSuggestions(check.script), checks: check.checks };
}

export { clipDuration };
