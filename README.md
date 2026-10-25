# Vibe Editor — AI video editing SaaS

Upload your footage, describe the video you want, get a finished edit: cuts, captions, music, sound design, motion graphics and effects. Then refine it by chat or on a real timeline.

## How it works
1. **Understand**: every upload is transcribed, cut into shots, described frame by frame and checked for silences, filler words and quality issues.
2. **Plan**: Claude (Opus 5.5) reads that footage manifest plus your brief or a recipe and proposes a plain-words plan you can toggle and approve.
3. **Build**: a deterministic builder turns the plan into an *edit script* (JSON timeline) using only validated operations: hook first, silence and filler removal, jump cuts, punch-ins, animated captions, ducked music, SFX, titles, b-roll, colour.
4. **Preview and refine**: the browser plays the script instantly with Remotion; chat edits and timeline edits are small operations that create checkpoints you can roll back.
5. **Export**: a worker renders the script with Remotion, normalises loudness with FFmpeg, writes an SRT and a thumbnail, and gives you a share link.

Without API keys the whole app runs in **mock mode** (heuristic plans and edits, placeholder music and stock), so you can click through everything before adding keys.

## Repository
| Path | What |
|---|---|
| `apps/web` | Next.js 15 app: auth, home, recipes, uploads, asset library, projects, editor (chat + preview + timeline + inspector), exports, brand kit, billing, settings, help, marketing pages |
| `apps/worker` | BullMQ worker that runs pipeline jobs (needs Redis) |
| `packages/edl` | The edit-script schema, edit operations, checks and the catalogue of caption styles, components, transitions, effects, music moods and SFX |
| `packages/compositions` | Remotion renderer for the edit script (12 caption styles, 12 graphic components, 8 transitions, effects, audio ducking) |
| `packages/agent` | Claude editing agent: footage manifest, plan, deterministic builder, tool-based chat edits, self-check, vision, recipes |
| `packages/pipeline` | Jobs: ingest, analyze, plan, build, edit, render, thumbnail, generate, cleanup; media provider (ElevenLabs, Pexels/Pixabay, mocks) |
| `packages/media` | FFmpeg/ffprobe helpers |
| `packages/core` | Env, storage (local or S3/R2), queue (BullMQ or inline), plan limits |
| `packages/db` | Prisma schema, client, recipe seed |
| `docs/` | Product analysis, spec, architecture, costs, roadmap, feature design, Railway deployment |

## Run locally
```
cp .env.example .env            # set AUTH_SECRET; API keys are optional
pnpm install
pnpm db:push && pnpm db:seed    # needs DATABASE_URL pointing at Postgres
pnpm dev                        # http://localhost:3000 — jobs run inline (no Redis needed)
```
Optional worker (recommended for renders): run Redis, set `REDIS_URL`, then `pnpm dev:worker`.

Tests: `pnpm test` (edit-script ops, FFmpeg helpers, agent in mock mode, pipeline end to end against the local database).

## Deploy
See `docs/08-deploy-railway.md`: two services (`Dockerfile.web`, `Dockerfile.worker`) plus Postgres, Redis and a bucket on Railway.

## Keys
| Variable | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | Claude planning, chat edits, director review, frame descriptions (otherwise mock mode) |
| `DEEPGRAM_API_KEY` | Real transcription with word timestamps and speakers |
| `ELEVENLABS_API_KEY` | Generated music, sound effects and voice-over |
| `PEXELS_API_KEY` / `PIXABAY_API_KEY` | Stock b-roll |
| `STRIPE_*` | Subscriptions |
| `S3_*` | Object storage (Cloudflare R2, Railway bucket, AWS) |
