# 07 — Feature Design (what we build)

This is the product as the user experiences it. No costs, no legal, minimal technicalities. Each feature is tagged **MVP** (first build) or **Next** (after the first build works). Deployment target is **Railway** (web app, background workers, Postgres, Redis and storage in one project); editing is **code-driven**: the AI writes and parameterises video components (Remotion-style React compositions) rather than dragging pixels, so every edit is reproducible and tweakable.

---

## 1. The promise to the user
> "Drop your footage, tell me what you want, and I'll hand you a finished video. Change anything by talking to me or by touching the timeline."

Three rules the whole app follows:
1. **Never make the user wait blind.** Every step shows what is happening and roughly how long it takes.
2. **Show the plan before doing the work.** The user approves the edit plan in plain words.
3. **Everything is reversible.** Every AI change and every manual change is a version the user can go back to.

---

## 2. Screens

### 2.1 Home (MVP)
The screen from the reference, improved.
- Greeting with the user's name and a rotating verb: "Let's cut your product demo, Priya."
- **Big prompt box**: "Describe your video, or drop footage…" Supports paste of a YouTube/Drive/Dropbox link (Next), drag-and-drop of many files, and the upload button.
- Under the box: **aspect ratio** (Auto / 9:16 / 16:9 / 1:1 / 4:5), **target length** (Auto / 15s / 30s / 60s / 3 min / full), **style chips** (Montage, Vlog, Talking-head, Explainer, Product demo, Ad/Promo, Launch video, Podcast clip, Tutorial).
- "Auto" aspect ratio detects the footage and the stated platform ("for TikTok" → 9:16).
- Below: tabs **Recipes** / **Your projects** / **Trending** (Next).
- Keyboard: `/` focuses the prompt, `Cmd+Enter` submits.

### 2.2 Recipes gallery (MVP)
- Categories: UGC, Clipping, Vlog, Effect, Viral trends, Travel montage, Product showcase, Aftermovie, Explainer, Talking-head, Launch video, Podcast.
- Card = looping preview on hover, title, duration, sizes it comes in, **"What to bring"** (e.g. "1–3 clips of you talking, 2+ minutes"), and a "Remix" button.
- Filters: short-form / long-form, size, type; search box.
- Each recipe opens a mini brief: pick size, add clips, optional one-line twist ("make it moodier"). Then it runs.
- Users can **save their own recipe** from any finished project ("Save as recipe") and reuse it (MVP). Share/publish recipes to the public gallery (Next).

### 2.3 Upload & footage understanding (MVP)
- Multi-file drag-and-drop, folders, up to many gigabytes, resumable; the user can start writing the brief while uploads run.
- Each clip gets: thumbnail strip, duration, transcript, detected speakers, scene list, and a one-line AI description ("you at the desk explaining pricing, good lighting, slight shake").
- Footage health check: silence, shaky sections, dark shots, dead air, filler words, flagged and counted ("I found 14 silences and 9 'ums'").
- **Footage search** (Next): "find where I mention the price" or "the shot of the coffee cup".
- Asset library: all uploads, generated media, brand assets, reusable across projects, with folders and tags.

### 2.4 The brief → the plan (MVP)
- The user writes a prompt or picks a recipe (or both) and optionally attaches a **reference video** (Next: link; MVP: upload).
- The AI replies with a **plan in plain words**, not a render:
  > Hook: your line "most founders get this wrong" (0:42) opens the video.
  > 14 silences cut, 6 jump cuts on sentence breaks, punch-in zoom every ~10 s.
  > Captions: Bold Pop style, keywords highlighted in yellow.
  > Music: upbeat lo-fi under speech, ducked. 3 whoosh SFX on cuts.
  > Title card "3 pricing mistakes" at 0:00, end card with your handle.
  > Estimated length 48 s, 9:16.
- Plan is editable inline: toggle any line off, change a style, type a counter-instruction. **Approve** builds the draft.
- Quick preferences remembered per user: "always remove filler words", "never add music", "captions always on".

### 2.5 Editor (MVP core, grows over time)
Layout: **chat (left)** · **preview (centre)** · **inspector (right)** · **timeline (bottom)**. Any panel collapses.

**Chat panel**
- Conversational edits: "make the intro faster", "swap music to cinematic", "remove the part where I cough", "add my name as a lower third at the start", "make captions bigger and white".
- Each reply says exactly what changed ("Trimmed 3 clips, replaced music, added lower third") and creates a **checkpoint**.
- Suggestions chips after every draft: "Tighten pacing", "Add a hook title", "Try a different caption style", "Make a 15 s cut".
- Multiple threads per project (Next). Message queue: send several instructions, they run in order (MVP).

**Preview**
- Instant playback of the current edit without a server render; scrubbing, loop ranges, safe-zone overlay for each platform, captions toggle.
- Compare mode: current vs previous checkpoint side by side (Next).

**Timeline**
- Tracks: video, b-roll, captions, music, SFX, voice-over, graphics. Trim, split, move, delete, mute, speed, snap, ripple delete, zoom, waveform.
- Clicking any AI decision on the timeline explains it ("cut here because of a 1.3 s silence") and offers "undo this one".
- Keyboard: space, J/K/L, I/O, Cmd+Z/Shift+Cmd+Z, Delete, S to split, C captions.

**Inspector**
- Selected clip: transform, crop/reframe, speed, colour preset, effects list.
- Captions: style gallery (12 at launch: Bold Pop, Clean Minimal, Hormozi, Karaoke, Typewriter, Outline, Glow, Boxed, Lower-third, Two-line, Emoji Pop, Handwritten), font, size, position, highlight colour, emoji on/off, word-by-word vs line, auto-correct and per-project dictionary (names, brand words).
- Music: pick from library by mood, regenerate, trim, ducking depth, fade in/out.
- Graphics: title, lower third, progress bar, CTA end card, subscribe bubble, pointer/zoom highlight; each with a few props.

**Versions**
- Every checkpoint listed with a thumbnail and the instruction that caused it; restore or branch ("try a variant from here").

### 2.6 Editing intelligence (what the AI actually does)
MVP:
- Silence and filler-word removal with natural breathing room; jump cuts on sentence boundaries.
- Hook selection: finds the strongest 2–3 s line and opens with it.
- Punch-in zooms, alternating framing, speed ramps on transitions.
- Word-by-word animated captions synced to speech, keyword and number highlighting, auto emoji (optional).
- Background music chosen by mood and tempo, ducked under speech; SFX on cuts, titles and reveals; loudness normalised.
- Titles, lower thirds, end cards, progress bars.
- Auto-reframe to vertical with face tracking; smart crop for 1:1 and 4:5.
- Stock b-roll matched to what is being said, inserted over long talking stretches.
- Colour presets (warm film, clean, moody, vibrant), grain, vignette, light leaks.
- Platform presets: TikTok, Reels, Shorts, YouTube, LinkedIn, X; correct length, size, safe zones and captions style per platform.
- **Self-check** before showing the draft: captions inside safe zones, audio not clipping, no black frames, length within target.

Next:
- Long-form → clips: "give me the 10 best clips" with a hook score and a title for each; batch export.
- Multi-cam: switch between angles on speaker change.
- AI b-roll generation (image → short video) when stock doesn't fit.
- AI voice-over and voice clean-up; translation with translated captions and dubbing.
- Screen-recording awareness for product demos: cursor zoom, click highlights, blur of sensitive fields.
- Reference-video style transfer: paste a viral video link, extract pacing, caption style, music energy, colour, apply to your footage.
- Beat-synced montages for travel/aftermovie recipes.
- 3D kinetic titles and product spins.
- "Explain this edit" narration for learners.

### 2.7 Export & share (MVP)
- Export panel: platform preset, resolution (720p/1080p/4K), captions burned-in or SRT, thumbnail (AI picks 3 frames + title overlay), filename.
- Progress with ETA; background export so the user can keep editing; notification when done.
- **One project → many outputs**: re-export the same edit as 9:16, 16:9 and 1:1 with a click (reframes automatically).
- Share link for review with timestamped comments (comments: Next).
- Direct publish to YouTube/TikTok/Instagram with caption text and hashtags suggested (Next). Scheduling (Next).

### 2.8 Projects (MVP)
- Grid of projects with thumbnail, status (Analysing / Draft ready / Exported), last edited, duration, platform tags.
- Duplicate, rename, archive, "Remix into another recipe".
- Project page remembers the chat, versions, exports and assets.

### 2.9 Brand kit & memory (MVP light, Next full)
- MVP: logo, two fonts, three colours, handle, intro/outro clips, default caption style. Applied automatically.
- Next: per-client kits for agencies; "learns from your edits" (keeps your pacing, caption and music preferences); saved voice.

### 2.10 Account, team, settings (MVP light)
- Sign in with Google/Apple/email. Plan and usage view (minutes used). Preferences (default aspect, captions, music on/off, language).
- Team workspaces with roles (Next). Public API and MCP server so other agents can edit videos (Next).

### 2.11 Help & onboarding (MVP)
- First-run: a 3-step tour with a sample project pre-loaded so the user sees a finished edit in 30 seconds.
- "Need any help?" opens a chat that can explain features and also act ("turn off emoji captions for me").
- Public changelog page, updated every release.

---

## 3. MVP cut list (what the first build must include)
1. Home with prompt box, upload, aspect/length/style chips.
2. Upload with progress; transcription and footage health report.
3. Plan → approve → draft, with a chat panel that edits and creates checkpoints.
4. Instant preview; timeline with trim/split/move/delete; inspector for captions, music and graphics.
5. 5 recipes done brilliantly: Talking-head, Vlog, Product demo, Montage, Explainer.
6. 12 caption styles, 10 title/lower-third/end-card components, 6 transitions, 4 colour presets, music library by mood, SFX pack.
7. Export with platform presets and multi-aspect re-export; share link.
8. Projects, asset library, basic brand kit, versions.
9. Onboarding sample project and help chat.

Everything in **Next** waits until real users have used the MVP.

---

## 4. How the AI edits with code (plain-language version)
- The footage is turned into words the AI can read: transcript, shots, what is on screen, audio events.
- The AI writes an **edit script**: an ordered list of clips, cuts, captions, music, SFX and graphics with exact timings and the component and props to use for each.
- A library of ready-made, designer-built components (captions, titles, transitions, effects) is what the script points at, so the output always looks polished and consistent.
- The preview plays that script instantly in the browser; exporting renders the same script on a worker.
- Chat edits change the script, never the pixels, so they are fast and undoable.
- New looks are added by adding components to the library, which the AI can use immediately.

## 5. Deployment shape on Railway (one line each)
Web app service (Next.js) · worker service (transcription, analysis, render) · Postgres · Redis (queues) · object storage bucket for media · scheduled job for cleanup. Preview environments per branch; one click to production.
