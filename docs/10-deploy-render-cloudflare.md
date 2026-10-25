# 10 — Deploying on Render + Cloudflare R2

Render runs the web app, the worker, Postgres and Redis from one Blueprint file (`render.yaml`). Cloudflare R2 stores all video (uploads, proxies, renders) with zero egress fees. Nothing in the code changes between Railway and Render; only environment variables differ.

## Part A — Cloudflare R2 (10 minutes)
1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket** → name `vibe-media`, location Automatic.
2. In the bucket → **Settings** → **CORS policy** → Edit → paste (replace the origin with your Render URL once you have it; `*` is fine for the first test):
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
   `ExposeHeaders: ETag` is required for large multipart uploads from the browser.
3. R2 overview → **Manage R2 API Tokens** → **Create API token** → permission *Object Read & Write*, scoped to the bucket. Save the **Access Key ID**, **Secret Access Key** and the **endpoint** `https://<account-id>.r2.cloudflarestorage.com`.

## Part B — Render (15 minutes)
1. render.com → sign up with GitHub → **New → Blueprint** → select `highontrading/vibe-editing-user-app` (branch `claude/keen-edison-cwyu5c`).
2. Render reads `render.yaml` and lists: `vibe-web` (web), `vibe-worker` (worker), `vibe-redis` (Key Value), `vibe-db` (Postgres). It prompts for the variables marked `sync: false`. Fill:
   - `S3_ENDPOINT`, `S3_BUCKET` (`vibe-media`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` from Part A, on both web and worker.
   - `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `PEXELS_API_KEY` (leave blank to run in mock mode).
   - `APP_URL`: leave blank for now.
3. Click **Apply**. The first Docker builds take 5–10 minutes (FFmpeg + Chromium are installed in the image).
4. Open `vibe-web` → copy its URL (`https://vibe-web-xxxx.onrender.com`). Set `APP_URL` to that value on **both** `vibe-web` and `vibe-worker` (Environment tab) and save; both redeploy.
5. Check `https://<your-url>/api/health` → `{"ok":true,"queue":"redis","storage":"s3","ai":"claude"}`. Sign up at `/signup` and run a project.
6. Go back to the R2 CORS policy and replace `"*"` with your exact `APP_URL`.

## Plans and sizing
- `vibe-web`: Starter is fine to begin.
- `vibe-worker`: Standard (2 GB RAM) works for 720p/1080p renders; move to Pro (4 GB, more CPU) when renders feel slow or 4K is enabled. Renders are CPU-bound.
- `vibe-db`: basic-256mb to start. `vibe-redis`: free tier is enough for the queue.
- Preview environments: Render → Blueprint settings → enable "Preview Environments" for pull requests.

## Stripe (when you turn on billing)
Create three recurring prices, add `STRIPE_SECRET_KEY`, `STRIPE_PRICE_CREATOR`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO` to `vibe-web`, add a webhook endpoint `https://<your-url>/api/billing/webhook` (events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

## Other combinations that also work
- **Northflank** (services + Postgres + Redis + object storage, all built in) or **DigitalOcean App Platform** (+ Spaces) if you want a single vendor with storage included.
- **Fly.io** + Cloudflare R2 for a CPU-heavy worker fleet (CLI-driven).
- **Coolify on a Hetzner server** + R2 for the cheapest option once you are comfortable managing a server.
- Cloudflare alone is not enough today: Workers cannot run FFmpeg/Chromium renders and there is no managed Postgres, so keep Cloudflare for R2 (and later for DNS/CDN in front of the app).
