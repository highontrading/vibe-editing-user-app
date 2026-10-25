# 05 — Build Roadmap

Six phases. Each one ends with something a user can touch, and each one is a usable product on its own. Deployment target throughout: Railway (web service, worker service, Postgres, Redis, storage bucket).

## Phase 0 — Skeleton (days 1–3)
Goal: the app exists, deploys, and a user can sign in.
- Monorepo: `apps/web` (Next.js UI + API), `apps/worker` (jobs: ingest, transcribe, analyse, render), `packages/edl` (edit-script schema and validation), `packages/compositions` (caption, title, transition, effect components), `packages/agent` (prompts, tools, recipes).
- Auth (Google/Apple/email), Postgres schema, Redis queue, storage bucket, Railway project with preview environments.
- Design system: dark theme, serif display font, sans body, shared components (buttons, cards, panels, dialogs, toasts).
- Home screen shell with prompt box, chips and empty Recipes/Projects tabs.
Done when: sign in → Home → create an empty project, on a public Railway URL.

## Phase 1 — Upload → understand → captioned export (week 1–2)
Goal: the simplest useful product: upload a clip, get a beautifully captioned vertical video.
- Resumable multi-file upload with progress; asset library.
- Ingest: proxy, thumbnails, waveform, duration.
- Transcription with word timestamps and speakers; footage health report (silences, fillers, shaky/dark).
- 12 caption styles as components; caption inspector (style, font, size, position, highlight colour, emoji, dictionary).
- Instant browser preview of the edit script; server render on export; export panel with platform presets and SRT.
- Projects grid and project page.
Done when: a user uploads a talking clip and exports a captioned 9:16 video with no manual work.

## Phase 2 — The editing agent (weeks 3–5)
Goal: the core promise. Prompt + footage → plan → draft → chat edits.
- Footage manifest: transcript + shots + frame descriptions + audio events.
- Agent with tools: read manifest, search stock, pick music by mood, pick SFX, use components, propose edit script, self-check.
- **Plan step**: plain-words plan the user can toggle, change and approve.
- Edit intelligence: silence/filler removal, hook selection, jump cuts, punch-ins, ducked music, SFX on cuts, titles/lower thirds/end cards, face-tracked reframe, stock b-roll, colour presets, loudness normalisation.
- Chat panel with checkpoints, "what changed" summaries and suggestion chips; message queue.
- Versions panel with restore.
- 5 recipes: Talking-head, Vlog, Product demo, Montage, Explainer.
Done when: upload footage + one sentence → finished short-form edit in a couple of minutes, then "make the intro faster" works.

## Phase 3 — Timeline and control (weeks 6–7)
Goal: the last 10 % is a drag, not a prompt.
- Multi-track timeline: trim, split, move, delete, mute, speed, snap, ripple delete, zoom, waveform.
- Click any AI decision → explanation + single undo.
- Inspector for clips (transform, crop, speed, colour, effects), music (trim, ducking, fades), graphics (props).
- Keyboard shortcuts; safe-zone overlay; multi-aspect re-export (9:16 / 16:9 / 1:1 from one project).
- Recipes gallery with hover previews, filters, "what to bring"; save any project as a recipe.
- Brand kit (logo, fonts, colours, handle, intro/outro, default caption style).
Done when: a user can fix anything the AI got wrong without leaving the app.

## Phase 4 — Launch polish (week 8)
Goal: ready for strangers.
- Onboarding with a pre-loaded sample project; help chat that explains and acts.
- Plans, usage view and billing; free tier with watermark.
- Share links; background exports with notifications; AI thumbnails.
- Landing page, pricing page, public changelog; error states, empty states, speed pass.
- Eval set of ~30 golden projects run on every prompt/model change.
Done when: public launch (Product Hunt, X, creator communities).

## Phase 5 — Differentiators (months 3–4, driven by user feedback)
In likely order:
1. Long-form → clips with hook scores and batch export (podcasters).
2. Reference-video style transfer from a pasted link.
3. URL ingest (YouTube, Drive, Dropbox) and direct publishing + scheduling.
4. AI b-roll generation, AI voice-over, voice clean-up, translation + dubbing.
5. Screen-recording-aware product demos (cursor zoom, click highlights).
6. Multi-cam, beat-synced montages, 3D kinetic titles.
7. Brand memory (learns your pacing/caption/music preferences), per-client kits.
8. Teams, comments on share links, public API + MCP server, recipe marketplace.
9. Desktop app for local footage.

## Working rhythm
- Ship to the Railway preview environment every day, to production at least weekly, with a changelog entry each time.
- Each phase starts by me scaffolding and building; you review on the live URL and we iterate on what you don't like before moving on.
- Component library (captions, titles, transitions, effects) grows continuously across all phases; it is what users judge first.
