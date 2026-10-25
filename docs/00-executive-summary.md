# 00 — Executive Summary

**Product**: a web-based "vibe editing" SaaS. Users upload footage, describe the video they want, and get a finished, platform-ready edit (cuts, captions, music, SFX, motion graphics, effects, reframing) in minutes, then refine it by chat or on a timeline. Direct competitor: cardboard.ai (YC W26, "Cursor for video").

**Verdict**: good idea, crowded market. Win by being narrower and better at launch (short-form talking-head/vlog edits), by transparent pricing and plan-before-render, and by a higher visual/audio quality bar. Details in `01` and `06`.

**How it works** (`03`): Claude Opus 5.5 acts as an editing agent. It never touches pixels; it reads a text "footage manifest" (transcript, shots, frame descriptions, audio events) and writes an Edit Decision List (JSON). A deterministic renderer (Remotion for graphics/captions, FFmpeg for cuts and final encode) turns the EDL into video. The browser previews the EDL instantly; server renders are reserved for export.

**Stack** (`04`): Next.js on Vercel · Supabase (Postgres/Auth/Realtime) · Cloudflare R2 (zero-egress media) · Inngest (durable jobs) · Modal (FFmpeg/Remotion workers, per-second billing) · Deepgram/AssemblyAI (transcription) · Anthropic (Opus 5.5 planner, Haiku 5.5 helpers) · ElevenLabs (music/SFX/voice) · fal.ai (generative b-roll) · Stripe.

**No GPUs to manage.** Rendering is CPU; everything else is an API call.

**Costs** (`04`): ≈ $0.46 per 5-minute edit with stock music, ≈ $2.83 with AI music, ≈ $4.30 with AI b-roll. Monthly bill ≈ $0–60 while building, $300–2,000 at 100 active users, $2,500–18,000 at 1,000. AI music and the LLM are the big variable costs; render and storage are small.

**Pricing** (`02`): Free (10 min, watermark) · Creator $19 · Pro $49 · Studio $149, credits debited on exported minutes with multipliers for 4K and generative media; previews and re-edits free.

**Roadmap** (`05`): Phase 1 upload→captions→export (weeks 2–3); Phase 2 the edit agent with 5 recipes (weeks 4–6); Phase 3 billing and launch (weeks 7–8); Phase 4 differentiators (reference remix, brand memory, clipping, publishing, API).

**Cardboard in one paragraph** (`01`): real NLE timeline in the browser, client-side WebCodecs rendering, agent with checkpoints and visual self-verification, semantic footage search, reframing, captions, voice cloning, generative media credits (Kling/Veo/Seedance/Hailuo), recipes and reference remix, Mac app with bring-your-own Claude/Codex. Pricing $8/$29/$59/$175 with two credit types, changed three times in ten months. Top complaints: credit burn, browser memory crashes, file caps, Mac-only local processing, no URL ingest, no publishing, agent needs guidance.

**Where we beat them**: predictable pricing with pre-run cost estimates · plan-before-render · server-side rendering (no crashes, no caps, works on Windows/phones) · pro audio (ducking, loudness, generated SFX/music) · deterministic QA checklist · URL ingest + publishing + analytics loop · brand memory + user recipes · public API/MCP.

**Legal must-dos** (`06`): licensed music only (ElevenLabs or a platform deal, never Suno/Udio wrappers), Pexels/Pixabay attribution rules, DMCA agent registration, content moderation, GDPR retention and sub-processor list.
