# 05 — Build Roadmap

A phased plan from empty repo to a paying product. Each phase ends with something a user can touch.

## Phase 0 — Foundations (week 1)
- Monorepo: `apps/web` (Next.js), `packages/edl` (schema + Zod), `packages/renderer` (Remotion compositions), `packages/agent` (Claude tools + prompts), `apps/worker` (Modal/Fly jobs).
- Accounts: Vercel, Cloudflare R2, Supabase (Postgres + Auth + Realtime) or Neon + Clerk, Anthropic API, ElevenLabs, AssemblyAI, Inngest, Stripe (test mode), Sentry, PostHog.
- CI: typecheck, lint, unit tests for the EDL schema and renderer snapshot tests.
- Design system: dark UI, serif display headings (like the reference), Inter/Geist body, shadcn components, Framer Motion.

## Phase 1 — Upload → transcript → captioned export (weeks 2–3)
The "hello world" of the product, but already useful.
- Direct-to-R2 multipart uploads with progress + resume.
- Ingest worker (proxy, thumbnails, waveform).
- Transcription with word timestamps.
- Remotion caption component (3–5 styles), browser preview, server render, download.
- Projects list, asset library.
- Outcome: a user can upload a clip and get a beautifully captioned vertical video.

## Phase 2 — The edit agent (weeks 4–6)
- Footage manifest (shots + frame descriptions via Claude vision + audio events).
- Agent loop with tools: manifest, stock search, SFX/music generation, EDL proposal with strict schema.
- 5 launch recipes: Talking-head, Vlog, Product demo, Montage, Explainer.
- Chat panel in the editor: "make it faster", "add a hook title", "change music to upbeat".
- EDL versioning + undo; manual nudges on a simple timeline (trim, reorder, delete).
- Silence removal, jump cuts, punch-ins, music ducking, loudness normalisation.
- Outcome: upload footage + one sentence → finished short-form edit in ~2 minutes.

## Phase 3 — Monetisation & polish (weeks 7–8)
- Stripe subscriptions + credits ledger + usage dashboard; free tier with watermark.
- Export presets (TikTok/Reels/Shorts/YouTube/LinkedIn), aspect-ratio auto-reframe (face-tracking crop).
- Onboarding, empty states, keyboard shortcuts, share links for review.
- Landing page, pricing page, changelog page (cardboard has one; ship it from day one).
- Outcome: public launch (Product Hunt, X, creator communities).

## Phase 4 — Differentiators (months 3–4)
- Reference-video remix (upload a viral video → extract style profile → apply to your footage).
- Brand kits (fonts, colours, logo, intro/outro), team workspaces, comments.
- Long-form → clips (podcast clipping with virality scoring).
- AI b-roll (image/video generation), AI voice-over, translation + dubbed captions.
- Self-review loop (agent critiques its own render and fixes it).
- Public API + Zapier/Make for agencies.
- Mobile-friendly review page; later a Tauri desktop app.

## Phase 5 — Scale (when > 1,000 paying users)
- Dedicated render fleet (Fly Machines/Hetzner) to cut per-minute cost ~5–10x vs serverless.
- Self-hosted WhisperX on GPU for transcription at volume.
- Multi-region R2 + CDN tuning, cold-storage lifecycle rules (delete raw footage after 30 days on free tier).
- SOC 2 / enterprise SSO if you go after agencies and brands.

## Team / effort reality check
- Solo founder + Claude Code: Phases 0–3 in ~8–10 weeks if you focus. The renderer component library is where most hand-craft goes; the backend is largely glue.
- Hire/contract one motion designer early to produce caption styles and title animations; that visual quality is what users judge in the first 5 seconds.

## Definition of "better than cardboard" (what we optimise for)
1. **Speed to first preview** under 5 seconds (browser-side EDL playback), full render under 2 minutes for 60 s.
2. **Editability**: every AI decision is visible and reversible on a real timeline; cardboard-style chat *plus* a manual editor.
3. **Transparency**: show the plan ("I cut 14 silences, added 3 punch-ins, 2 SFX, captions in Bold style") before rendering.
4. **Quality floor**: loudness-normalised audio, clean caption typography, no janky transitions, platform-correct encodes.
5. **Pricing clarity**: minutes-based credits, no surprise watermarks, free tier that is genuinely usable.
