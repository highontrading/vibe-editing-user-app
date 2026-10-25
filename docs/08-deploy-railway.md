# 08 — Deploying on Railway

The app is two services plus two databases in one Railway project. Everything is config-as-code; the only manual steps are creating the project and pasting environment variables.

## Services
| Service | Source | Dockerfile | Notes |
|---|---|---|---|
| `web` | this repo | `Dockerfile.web` | Next.js app on port 3000. Runs jobs inline if `REDIS_URL` is unset (fine for the first users). |
| `worker` | this repo | `Dockerfile.worker` | BullMQ worker: transcription, analysis, AI agent, rendering. Needs `REDIS_URL`. Scale this one up when renders queue. |
| Postgres | Railway plugin | | `DATABASE_URL` |
| Redis | Railway plugin | | `REDIS_URL` |
| Bucket (optional) | Railway bucket or Cloudflare R2 | | `S3_*` variables. Without it, files are stored on a Railway volume mounted at `/app/data` (set `DATA_DIR=/app/data`). |

## Steps
1. **Create a project** on railway.com → "Deploy from GitHub repo" → pick this repository. This creates the `web` service. In the service settings set **Dockerfile path** to `Dockerfile.web` (or keep `railway.json`, which already points to it).
2. **Add a second service** from the same repo for the worker: Settings → Build → Dockerfile path `Dockerfile.worker`; Settings → Networking: no public domain needed; Healthcheck path `/health`.
3. **Add Postgres and Redis** from the Railway catalogue. Reference their variables in both services (`DATABASE_URL`, `REDIS_URL`).
4. **Storage**: create a bucket (Railway → New → Bucket, or Cloudflare R2) and set `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` on **both** services (leave `S3_PUBLIC_URL` empty unless the bucket is public). A Railway volume cannot be shared between two services, so a volume only works for the single-service setup described under "Smallest possible deploy".
5. **Variables** on both services (copy from `.env.example`): `APP_URL` (the web service's public URL), `AUTH_SECRET` (`openssl rand -base64 32`), `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `PEXELS_API_KEY`, `STRIPE_*`, `AUTH_GOOGLE_*`. Without the AI keys the app runs in mock mode (deterministic edits, placeholder music), which is useful for a first smoke test.
6. **Generate a domain** for `web` (Settings → Networking). Set `APP_URL` to it and redeploy.
7. The first boot of `web` runs `prisma db push` and seeds the recipes. Later, switch to migrations: `pnpm --filter @vibe/db migrate:dev` locally, commit `packages/db/prisma/migrations`, and change the CMD in `Dockerfile.web` to `prisma migrate deploy`.
8. **Stripe**: add a webhook endpoint `https://<domain>/api/billing/webhook` with events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`; paste the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Smallest possible deploy (one service, no worker)
If you only want to click around first: deploy just `web` + Postgres, attach a volume to `web` mounted at `/app/data`, set `DATA_DIR=/app/data`, and leave `REDIS_URL` and all `S3_*` empty. Jobs then run inside the web process (renders will make the app slow while they run). Add the worker, Redis and a bucket before inviting users.

## Sizing
- `web`: 1 vCPU / 1 GB is enough at the start.
- `worker`: 2–4 vCPU / 4–8 GB. Rendering is CPU-bound; set `RENDER_CONCURRENCY=1` per 2 vCPU. Add replicas as the queue grows.
- Preview environments: enable "PR environments" in the Railway project so every branch gets its own URL.

## Local development
```
cp .env.example .env            # fill AUTH_SECRET; keys optional
pnpm install
pnpm db:push && pnpm db:seed    # needs DATABASE_URL (local Postgres)
pnpm dev                        # web on :3000, jobs run inline (no Redis needed)
# optional second terminal with Redis running:
REDIS_URL=redis://localhost:6379 pnpm dev:worker
```
