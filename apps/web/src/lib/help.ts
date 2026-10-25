/**
 * Built-in help: a keyword-matched FAQ. `answerHelp()` is the hook the agent
 * team can later route through a model when ANTHROPIC_API_KEY exists; for now
 * it always answers from the FAQ map (no model calls are made here).
 */
export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: "Getting started" | "Editing" | "Uploads" | "Export" | "Billing" | "Account";
}

export const FAQ: FaqEntry[] = [
  { id: "what", category: "Getting started", question: "What does this app do?", answer: "Drop your footage, describe the video you want (or pick a recipe), and the editor writes a plan in plain words. Approve it and a finished draft is built: cuts, captions, music, titles. Then change anything by chatting or by touching the timeline.", keywords: ["what", "does", "app", "do", "how", "work", "works", "start", "begin"] },
  { id: "upload", category: "Uploads", question: "How do I upload footage?", answer: "Drag files or whole folders onto the prompt box on Home, or use the upload button. Uploads run in the background (see the tray bottom-right) and you can start writing your brief while they finish. Supported: MP4, MOV, WebM, MKV, MP3, WAV, M4A, PNG, JPG.", keywords: ["upload", "drag", "drop", "footage", "files", "folder", "format", "mp4", "mov", "supported"] },
  { id: "size", category: "Uploads", question: "Is there a file size limit?", answer: "Large files are uploaded in resumable parts, so multi-gigabyte clips are fine. Your plan sets total storage: 2 GB on Free, 20 GB on Creator, 200 GB on Pro and 1 TB on Studio.", keywords: ["size", "limit", "large", "big", "gb", "storage", "resumable"] },
  { id: "analysis", category: "Uploads", question: "What happens after upload?", answer: "Each clip is analysed: thumbnail strip, transcript, speakers, scene list, a one-line description and a footage health check that counts silences, filler words, shaky and dark sections. You can see all of it in the asset library.", keywords: ["analysis", "analyse", "analyze", "transcript", "processing", "health", "silence", "filler", "um"] },
  { id: "plan", category: "Editing", question: "What is the plan and why do I approve it?", answer: "Before any work is done, the editor shows what it intends to do: which hook opens the video, how many silences are cut, caption style, music, titles and the estimated length. Toggle lines off, change a style or type a counter-instruction, then press Approve to build the draft.", keywords: ["plan", "approve", "approval", "before", "hook"] },
  { id: "chat", category: "Editing", question: "How do I change the edit?", answer: "Type what you want in the chat: 'make the intro faster', 'swap music to cinematic', 'remove the part where I cough', 'make captions bigger and white'. Every reply says exactly what changed and creates a checkpoint you can go back to. You can also trim, split, move and delete directly on the timeline.", keywords: ["change", "edit", "chat", "instruction", "tell", "faster", "music", "remove", "timeline"] },
  { id: "undo", category: "Editing", question: "Can I undo an AI change?", answer: "Yes. Everything is a version. Open Versions in the editor to restore any checkpoint, or click any AI decision on the timeline to see why it was made and undo just that one. Cmd+Z works for manual edits.", keywords: ["undo", "revert", "version", "checkpoint", "restore", "back", "history"] },
  { id: "captions", category: "Editing", question: "How do captions work?", answer: "Captions are generated word-by-word from the transcript and synced to speech. Pick one of 12 styles (Bold Pop, Clean Minimal, Hormozi, Karaoke, Typewriter, Outline, Glow, Boxed, Lower-third, Two-line, Emoji Pop, Handwritten) in the inspector, set a default in your Brand kit, or ask in chat: 'use Karaoke captions'. Add names and brand words to the project dictionary to fix spellings.", keywords: ["caption", "captions", "subtitle", "subtitles", "style", "emoji", "font", "dictionary", "spelling"] },
  { id: "music", category: "Editing", question: "Where does the music come from?", answer: "Music is picked from the built-in library by mood (upbeat, lo-fi, cinematic, chill, energetic, emotional, corporate, funky, dark, acoustic) and ducked under speech automatically. Say 'no music' or set Music off in Settings to never add it.", keywords: ["music", "song", "track", "mood", "duck", "ducking", "volume", "sfx", "sound"] },
  { id: "recipes", category: "Editing", question: "What are recipes?", answer: "Recipes are reusable edit styles: Talking-head, Vlog, Product demo, Montage, Explainer and more. Each says what footage to bring and the sizes it comes in. Pick one, add your clips and an optional twist ('make it moodier'). From any finished project you can Save as recipe to reuse your own style.", keywords: ["recipe", "recipes", "template", "remix", "save as recipe", "style", "reuse"] },
  { id: "aspect", category: "Editing", question: "How do I get a vertical / square version?", answer: "Choose 9:16, 16:9, 1:1 or 4:5 under the prompt box, or say the platform ('for TikTok'). Auto-reframe tracks faces when converting landscape to vertical. In Export you can re-export the same edit in several sizes with one click.", keywords: ["aspect", "vertical", "square", "ratio", "9:16", "16:9", "reframe", "tiktok", "portrait", "landscape"] },
  { id: "export", category: "Export", question: "How do I export?", answer: "Open Export in the editor: choose the platform preset, resolution (720p / 1080p / 4K depending on plan), captions burned-in or as SRT, and a thumbnail. Exports render in the background; you get a notification and a share link when done.", keywords: ["export", "download", "render", "resolution", "4k", "1080p", "srt", "thumbnail", "share", "link"] },
  { id: "watermark", category: "Billing", question: "Why is there a watermark?", answer: "Free exports carry a small watermark and are limited to 720p. Creator and above remove the watermark and unlock 1080p; Pro and Studio add 4K and generative features.", keywords: ["watermark", "logo", "remove", "free", "720p"] },
  { id: "minutes", category: "Billing", question: "What counts as a minute?", answer: "One minute of rendered export equals one minute of your monthly quota. Previews, captions and cuts are free. Quotas reset 30 days after your cycle started (see Billing).", keywords: ["minute", "minutes", "quota", "usage", "credits", "count", "reset", "cycle"] },
  { id: "plans", category: "Billing", question: "Which plans are there?", answer: "Free (10 min, 720p, watermark), Creator ($19: 120 min, 1080p), Pro ($49: 400 min, 4K, generative b-roll) and Studio ($149: 1500 min). Upgrade or manage your subscription on the Billing page.", keywords: ["plan", "plans", "price", "pricing", "upgrade", "subscription", "cancel", "billing", "pay", "invoice"] },
  { id: "brand", category: "Account", question: "How do I apply my brand?", answer: "Fill in the Brand kit: logo, fonts, colours, handle, intro and outro clips, default caption style and music mood. They are applied automatically to every new project.", keywords: ["brand", "logo", "colour", "color", "font", "handle", "intro", "outro", "kit"] },
  { id: "delete", category: "Account", question: "How do I delete my account or my footage?", answer: "Delete individual assets from the Asset library (this removes the files from storage). To delete your whole account and all data, use the danger zone at the bottom of Settings.", keywords: ["delete", "remove", "account", "privacy", "data", "gdpr", "erase"] },
  { id: "keyboard", category: "Editing", question: "Keyboard shortcuts?", answer: "Home: / focuses the prompt, Cmd+Enter submits. Editor: Space play/pause, J/K/L shuttle, I/O in and out points, S split, Delete removes, C toggles captions, Cmd+Z / Shift+Cmd+Z undo and redo.", keywords: ["keyboard", "shortcut", "shortcuts", "hotkey", "keys", "cmd", "space"] },
];

const STOP = new Set(["the", "a", "an", "to", "is", "it", "i", "my", "me", "of", "in", "on", "for", "and", "or", "can", "do", "does", "how", "what", "why", "with", "you", "your"]);

export function searchFaq(query: string, limit = 5): FaqEntry[] {
  const words = query.toLowerCase().replace(/[^a-z0-9:\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  if (!words.length) return FAQ.slice(0, limit);
  const scored = FAQ.map((f) => {
    let score = 0;
    for (const w of words) {
      if (f.keywords.includes(w)) score += 3;
      else if (f.keywords.some((k) => k.startsWith(w) || w.startsWith(k))) score += 1.5;
      if (f.question.toLowerCase().includes(w)) score += 2;
      if (f.answer.toLowerCase().includes(w)) score += 0.5;
    }
    return { f, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.f);
}

export interface HelpAnswer {
  answer: string;
  matched: FaqEntry | null;
  related: { id: string; question: string }[];
  /** true when a model produced the answer; false means the FAQ did. */
  fromModel: boolean;
}

/**
 * Hook for answering help chat messages. When ANTHROPIC_API_KEY exists the
 * agent team may route this through a model; this implementation only ever
 * returns the FAQ answer so no model calls originate here.
 */
export async function answerHelp(message: string): Promise<HelpAnswer> {
  const hits = searchFaq(message, 4);
  const best = hits[0] ?? null;
  const related = hits.slice(1).map((h) => ({ id: h.id, question: h.question }));
  if (!best) {
    return {
      answer: "I couldn't find that in the help topics yet. Try asking about uploads, the plan, captions, music, recipes, exports or billing. You can also email support@vibe.video and a human will get back to you.",
      matched: null,
      related: FAQ.slice(0, 3).map((f) => ({ id: f.id, question: f.question })),
      fromModel: false,
    };
  }
  return { answer: best.answer, matched: best, related, fromModel: false };
}
