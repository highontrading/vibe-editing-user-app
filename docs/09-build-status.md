# 09 — Build Status (first full build)

Everything below exists on the branch and was verified end to end in a browser against the production build with Redis and the worker: sign up → brief + upload on Home → footage analysed → plan shown → approved → draft built → live preview in the editor → chat edit ("switch captions to hormozi and make them bigger, and remove the music") → export → MP4 downloaded (20 s, h264/aac, captions, title, end card, watermark on the free plan).

## What is built
**Web app** (`apps/web`): login/signup, Home (prompt box, drop zone, aspect/length/style chips, recipes and projects tabs), Recipes gallery and detail with "Remix with my footage", Projects, Asset library with health report and transcript, Brand kit, Billing (Stripe Checkout/portal/webhook; dev plan switch when Stripe is not configured), Settings, Help (FAQ chat), Welcome tour with a generated sample project, Landing, Pricing, Changelog, Share page, Privacy, Terms.
**Editor** (`/editor/[projectId]`): footage stage (asset cards with live job messages, brief editor, add footage), plan stage (toggle/edit steps, counter-instructions, approve), building stage, full editor: chat with checkpoints, suggestion chips, checks list and restore; Remotion preview with custom controls, safe-zone overlay, compare mode; multi-track timeline (select, move, trim, split, delete, context menu, "Why this cut?"); inspector (clip transform/speed/volume/reframe/colour/effects/transitions, captions style gallery and settings and word editor, music mood/gain/ducking, graphics picker and props, global look, versions, checks); export dialog (platform presets, plan-gated resolution, burned captions or SRT, multi-aspect export) and export panel (progress, download, SRT, share link).
**Agent** (`packages/agent`): footage manifest, Claude Opus 5.5 plan with structured output, deterministic builder (hook first, silence/filler removal, jump cuts, punch-ins, captions, ducked music, SFX, titles, b-roll, colour, montage mode), tool-based chat edits with 29 strict tools, director review pass, self-check with auto-fixes, Haiku vision for frame descriptions, mock mode without keys. 23 recipes.
**Renderer** (`packages/compositions`): 12 caption styles, 12 graphic components, 8 transitions, 8 effects, 7 colour presets, audio ducking, fonts, watermark, gallery preview scripts.
**Pipeline** (`packages/pipeline`, `apps/worker`): ingest (proxy, poster, thumbnail strip, waveform, audio), analyze (Deepgram or mock transcript, scene detection, keyframes + vision, silences, loudness, fillers, hooks), plan, build, edit, render (Remotion + loudness normalisation + SRT + poster + minutes debit), thumbnail, generate, cleanup; media provider for ElevenLabs music/SFX/voice, Pexels/Pixabay stock, with mocks.
**Platform**: edit-script schema and operations with tests, Prisma schema, local or S3/R2 storage, BullMQ or inline jobs, Railway Dockerfiles and guide.

## Tests
`edl` 6, `media` 1, `agent` 15, `pipeline` 9 (including a real render), all passing. Web typecheck and production build pass.

## Known gaps (next iteration)
- Timeline: no cross-layer drag, no multi-select; waveform bars are placeholders (data is available); version thumbnails are placeholders.
- Share page has no comments; recipe cards have no video previews until preview files are uploaded.
- Face-tracked reframe uses the subject position from vision descriptions (centre/left/right), not per-frame tracking.
- Generated b-roll (image/video), voice-over UI, dubbing, long-form clipping, direct publishing and the public API are designed but not built.
- Inline job mode (no Redis) renders inside the web process and can stall it; use the worker for anything beyond a quick local test.
- Stripe flows are written against the current API but untested against a live account.
- Rendering speed: about 7× real time on 4 CPU cores for 720p; the worker should get 4–8 vCPU on Railway.

## Add keys to leave mock mode
`ANTHROPIC_API_KEY` (plans, edits, vision), `DEEPGRAM_API_KEY` (real transcripts), `ELEVENLABS_API_KEY` (music, SFX, voice), `PEXELS_API_KEY` (b-roll), `STRIPE_*` (billing), `S3_*` (bucket).
