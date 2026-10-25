# 03 — System Architecture

This is the technical blueprint for the vibe-editing platform. It is written so a small team (or one founder plus Claude Code) can build it end to end.

## 1. The core idea in one diagram

```
                ┌──────────────────────────────────────────────────────────┐
                │                        Browser (Next.js)                 │
                │  Upload footage → Chat with the editor → Live preview →   │
                │  Tweak on timeline → Export                              │
                └──────────────┬───────────────────────────▲───────────────┘
                               │ tus / multipart upload     │ HLS preview, WebSocket job events
                               ▼                            │
┌──────────────┐   ┌──────────────────────┐    ┌─────────────────────────┐
│ Cloudflare R2│◄──┤  API (Next.js routes │───►│ Postgres (Supabase/Neon)│
│ raw + renders│   │  + Hono/tRPC)        │    │ users, projects, jobs,  │
└──────┬───────┘   └──────────┬───────────┘    │ credits, EDL versions   │
       │                      │ enqueue         └─────────────────────────┘
       │                      ▼
       │           ┌──────────────────────┐
       │           │ Job orchestrator      │  Inngest / Trigger.dev (durable steps, retries)
       │           └──┬──────┬──────┬─────┘
       │              │      │      │
       ▼              ▼      ▼      ▼
┌────────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────────────────┐
│ INGEST     │ │ ANALYZE  │ │ EDIT AGENT   │ │ RENDER                    │
│ ffprobe,   │ │ Whisper/ │ │ Claude Opus  │ │ Remotion (React comps) or │
│ proxies,   │ │ AssemblyAI│ │ 5.5 + tools  │ │ FFmpeg filtergraph        │
│ thumbnails,│ │ scene cut,│ │ → writes an  │ │ on Modal / Fly Machines   │
│ waveform   │ │ frames → │ │ EDL (JSON)   │ │ (CPU; GPU only for genAI) │
│            │ │ Claude   │ │              │ │                           │
└────────────┘ │ vision   │ └──────┬───────┘ └───────────────────────────┘
               └──────────┘        │ calls media tools
                                   ▼
                 ┌──────────────────────────────────────────────┐
                 │ Media tool APIs: ElevenLabs (SFX/voice/music),│
                 │ stock (Pexels/Pixabay), fal.ai (image/video)  │
                 └──────────────────────────────────────────────┘
```

The single most important design decision: **the AI never touches pixels directly.** Claude produces an *Edit Decision List* (EDL): a JSON document describing clips, cuts, captions, music, SFX, effects, and motion graphics. A deterministic renderer turns the EDL into video. This gives you:

- Cheap, instant previews (the browser can play the EDL via Remotion Player before any render).
- Iterative edits ("make the intro faster") are tiny JSON diffs, not re-generation.
- Versioning, undo, and a manual timeline for free — the EDL *is* the timeline.
- Deterministic, testable output. The LLM is only responsible for creative decisions.

## 2. Component by component

### 2.1 Web app (frontend + API)
- **Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui.** Deployed on Vercel.
- UI surfaces: Home (prompt box + recipes, like the reference screenshots), Projects, Asset library, Editor (chat panel left, preview centre, timeline bottom, inspector right), Billing.
- **Remotion Player** in the browser renders the EDL live so users see the edit *before* paying for a server render.
- Real-time job progress via Supabase Realtime (or Pusher/Ably) — "Transcribing 40%… Planning cuts… Rendering 2/5 scenes".
- Auth: Clerk (fastest to ship, social login, orgs/teams later) or Supabase Auth (cheaper, fine for solo founder).

### 2.2 Uploads
- Never route video bytes through Vercel functions (4.5 MB body limit, 60 s–800 s timeouts).
- Browser uploads **directly to Cloudflare R2** using presigned multipart URLs (or `tus` via Uppy for resumable uploads of multi-GB files).
- R2 has **zero egress fees**, which matters enormously for video (every preview and download is egress).
- On upload complete, the API inserts an `asset` row and enqueues `ingest`.

### 2.3 Ingest worker
- `ffprobe` metadata, generate 720p H.264 proxy + HLS for preview, thumbnails every N seconds, audio waveform JSON, extract audio track (16 kHz mono WAV) for transcription.
- Runs on a CPU container (Modal / Fly Machine / Railway worker). FFmpeg is CPU-bound; GPUs don't help much for decode/encode of consumer footage except NVENC at high volume.

### 2.4 Analysis worker ("understanding the footage")
This is what makes the AI edit good. Produce a compact, text-only **footage manifest** Claude can reason over:
- **Transcript** with word-level timestamps and speaker labels (AssemblyAI / Deepgram / WhisperX).
- **Scene/shot boundaries** (PySceneDetect or FFmpeg scene filter).
- **Per-shot description**: sample 1–3 frames per shot, send to Claude vision as images (Claude does not accept video; Haiku 5.5 for cost, Opus for quality; a 720p frame ≈ 1,200 tokens; upload frames once via the Files API) → "medium shot, woman at desk talking, laptop on table, warm light, slight camera shake".
- **Audio events**: silence spans, laughter, music already present, loudness.
- **Quality signals**: blur, exposure, shake, filler words ("um"), dead air.
- Store as `analysis` JSON on the asset. 10 minutes of footage ≈ 10–25k tokens of manifest, which fits easily in a 1M-context model.

### 2.5 Edit agent (the "brain")
- **Model: `claude-opus-5-5`** with adaptive thinking (default) and `output_config.effort` set explicitly (`high` for the first plan, `medium` for follow-up tweaks). Haiku 5.5 for cheap sub-tasks (frame captioning, caption styling suggestions, title ideas).
- Runs as an **agentic loop using the Anthropic SDK tool runner**. Tools the agent can call:
  - `get_footage_manifest(asset_ids)` — returns transcript + shots.
  - `search_stock(query, kind)` — Pexels/Pixabay b-roll and images.
  - `generate_sfx(prompt, duration)` / `generate_music(mood, bpm, duration)` — ElevenLabs.
  - `generate_voiceover(text, voice)` — ElevenLabs / Cartesia.
  - `generate_image(prompt)` / `generate_broll_video(prompt)` — fal.ai (Flux, Kling/Veo).
  - `list_templates(category)` — your motion-graphic/caption/effect presets (Remotion components).
  - `propose_edl(edl)` — validated against a JSON schema (use `strict: true` tools).
  - `render_preview(edl, range)` — optional low-res render for the agent to self-check with vision.
- **Recipes** (your equivalent of cardboard's "recipes") are just stored prompts + preset EDL skeletons + style tokens (font, colour, caption style, pacing). A "Talking-head" recipe says: cut silences, jump-cut on sentence boundaries, punch-in zoom every 8–12 s, animated word-by-word captions, lo-fi bed at −18 LUFS, SFX whoosh on cuts.
- **Reference-video remix**: user uploads a reference → analyse it (pacing: avg shot length, caption style, music energy, colour) → store as a style profile → feed into the system prompt.
- Prompt caching: keep the system prompt + template catalogue + manifest as the stable cached prefix; put the user's latest instruction last. Follow-up edits then cost mostly cache reads.
- Conversation per project is stored in Postgres so "make it punchier" has full context.

### 2.6 EDL schema (the contract between AI and renderer)
```jsonc
{
  "version": 1,
  "output": { "width": 1080, "height": 1920, "fps": 30, "durationMs": 58000 },
  "tracks": [
    { "id": "v1", "kind": "video", "clips": [
      { "assetId": "a1", "inMs": 12000, "outMs": 17500, "startMs": 0,
        "transform": { "scale": 1.15, "x": 0, "y": -40 },           // punch-in
        "effects": [ { "type": "colorGrade", "preset": "warm-film" } ],
        "transitionIn": { "type": "cut" } }
    ]},
    { "id": "captions", "kind": "captions", "style": "hormozi-bold",
      "words": [ { "t": 0, "d": 320, "text": "So" }, ... ] },
    { "id": "music", "kind": "audio", "clips": [ { "assetId": "gen-music-1", "gainDb": -18, "ducking": true } ] },
    { "id": "sfx", "kind": "audio", "clips": [ { "assetId": "whoosh-01", "startMs": 5500 } ] },
    { "id": "gfx", "kind": "graphics", "items": [
      { "component": "LowerThird", "startMs": 1000, "durationMs": 4000, "props": { "name": "Priya", "title": "Founder" } },
      { "component": "KineticTitle", "startMs": 0, "durationMs": 2500, "props": { "text": "3 mistakes" } }
    ]}
  ]
}
```
Validate every EDL with Zod before it reaches the renderer; reject or auto-repair invalid ones and send the error back to the agent as a tool result.

### 2.7 Renderer
Two viable engines; the recommendation is **Remotion**, with FFmpeg as the fallback for pure-cut jobs.

| | Remotion | FFmpeg filtergraph |
|---|---|---|
| Motion graphics, animated captions, 3D titles | Excellent (it's React + CSS + WebGL) | Painful |
| Preview in browser | Native (`@remotion/player`) | No |
| Speed | Slower (headless Chrome frames); parallelise via Lambda/Modal | Very fast for cut+concat+overlay |
| Licence | Free for individuals/≤3 people; prompt-to-video products need "Remotion for Automators": $0.01/render, $100/mo minimum | Free (LGPL/GPL) |
| Where | Remotion Lambda (AWS) or self-host on Modal/Fly | Any CPU box |

Pragmatic path: Remotion for anything with graphics/captions (most jobs); for jobs with no graphics, cut and concat with FFmpeg directly. Always do a final FFmpeg pass for loudness normalisation (EBU R128) and correct encode settings per platform (TikTok/Reels/YouTube).

Render output goes back to R2; the UI gets a signed URL. Keep the EDL so re-exports in another aspect ratio are cheap (just re-render with a reframing pass).

### 2.8 Job orchestration
- Use **Inngest** or **Trigger.dev** (both have generous free tiers, durable step functions, retries, concurrency limits, and a dashboard). Avoid rolling your own BullMQ at first.
- Pipeline per project: `ingest → analyze → plan (agent) → fetch/generate media → render → finalize`.
- Each step is idempotent and writes progress to the `jobs` table; the UI subscribes.
- Heavy compute (FFmpeg, Remotion, WhisperX if self-hosted) runs on **Modal** (pay-per-second CPU/GPU, scales to zero) or **Google Cloud Run Jobs**. Modal is the easiest for a non-infra founder. (Fly.io dropped GPU machines in Aug 2026; its CPU machines are still fine for a dedicated render fleet later.)

### 2.9 Data model (Postgres)
`users`, `workspaces`, `subscriptions` (Stripe), `credit_ledger`, `assets` (raw uploads, generated media, renders), `asset_analysis`, `projects`, `edl_versions` (every agent/user change = new version), `conversations`/`messages`, `jobs`, `recipes`, `style_profiles`, `exports`.

### 2.10 Billing
- Stripe Billing (subscriptions) + a **credits ledger**: 1 credit ≈ 1 minute of rendered output, with multipliers for 4K, AI b-roll generation, voice cloning. Bill what costs you money; let cheap things (captions, cuts) feel unlimited.
- Hard caps + overage packs. Free tier: watermark + 720p + 3 exports.
- Consider Paddle or Lemon Squeezy as merchant of record if you want them to handle global sales tax from day one (they take ~5% but remove a large compliance burden).

### 2.11 Observability & safety
- Sentry (errors), PostHog (product analytics + session replay), Axiom/Betterstack (logs), Stripe webhooks tested with the CLI.
- Log every Claude call's `usage` (tokens, cache reads) per project so you know your gross margin per edit.
- Content moderation: scan transcripts/frames before processing; terms of service for copyrighted footage; DMCA agent registration.

## 3. Why not GPUs everywhere?
Most of this product is **CPU + API calls**. GPUs are needed only if you self-host Whisper (not worth it below ~2,000 hours/month), run your own generative video/image models (don't — use fal.ai/Replicate), or want NVENC encoding at very high volume. Start with zero GPUs you manage.

## 4. Desktop app (later)
Cardboard ships a Mac app (their "Desktop" badge on recipes implies some recipes need local processing, likely for screen recording or large local files). You can get 80 % of that with a Tauri or Electron shell around the web app plus native file access, after the web product has paying users.

## 5. What makes the edit quality actually good (the hard part)
1. Rich footage manifest (transcript + shot descriptions + audio events). Garbage in, garbage out.
2. A library of 50–150 high-quality Remotion components (caption styles, title animations, transitions, lower thirds, progress bars, emoji pops, zoom patterns). This is your moat and your "recipes".
3. Opinionated recipe prompts written by an actual editor: pacing rules, when to cut, when to punch-in, music ducking, caption rhythm.
4. Self-review: after a draft render, give Claude a contact-sheet of frames + the EDL and ask it to critique and fix (one extra loop raises quality a lot).
5. Fast iteration loop: previews in < 5 s, full render in < 1–2 min for a 60 s short.
