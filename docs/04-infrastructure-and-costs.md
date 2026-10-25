# 04 — Infrastructure, Deployment and Costs

Prices researched 2026-10-25. Anthropic prices are from the official docs; most other vendors come from their pricing pages as summarised by search results and 2026 trackers. Items marked **[unverified]** could not be confirmed on the vendor page. Re-check before committing to a plan.

## 1. Short answer for a non-infra founder
- **You do not need GPUs you manage.** The product is CPU work (FFmpeg) plus API calls (Claude, transcription, music, stock). GPUs enter only if you later self-host Whisper or generative models; rent those by the second from Modal or RunPod when the time comes.
- **Start on managed, scale-to-zero services** so the bill at 0 users is roughly $0–60/month, and grows with usage.
- **The expensive parts per edit are AI music and the LLM**, not rendering or storage. Stock music by default and AI music as an add-on keeps cost per project under $0.50.

## 2. Recommended v1 stack (cheapest credible path)
| Layer | Pick | Why | Price |
|---|---|---|---|
| Web app | Next.js on **Vercel Pro** | Zero-ops, previews per branch | $20/user/mo + usage; Hobby free while building |
| Database + auth + realtime | **Supabase Pro** (Postgres, Auth, Realtime, RLS) | One bill, 50k MAU auth included | $25/mo + compute; Free tier while building. Alternative: Neon + Better Auth (scale-to-zero) |
| Media storage + CDN | **Cloudflare R2** | **Zero egress**; S3 would cost $0.09/GB every time a video is previewed or downloaded | $0.015/GB-month; 10 GB free |
| Uploads | Browser → R2 presigned **multipart** via Uppy (64–128 MB parts), resumable | Vercel functions cap bodies at 4.5 MB; never proxy video through the app | free |
| Job orchestration | **Inngest** (or Trigger.dev) | Durable steps, retries, concurrency, dashboard; no queue to run | Free 50k runs/mo; Pro $99/mo |
| Compute workers (FFmpeg, keyframes, Remotion) | **Modal** (Python, per-second CPU/GPU, scale to zero) or **Google Cloud Run Jobs** | Easiest serverless containers; GPU optional | Modal ≈ $0.047/core-hr; $30/mo free credit. Cloud Run L4 GPU ≈ $0.67/hr if ever needed |
| Transcription | **Deepgram Nova-3** or **AssemblyAI** | Word timestamps + speaker labels, no ops | $0.0043/min (Deepgram) · $0.0035/min (AssemblyAI). Groq Whisper $0.04/hr once volume is high |
| LLM | **Claude Opus 5.5** (`claude-opus-5-5`) for the edit plan; **Haiku 5.5** for frame descriptions and cheap sub-tasks | Best quality/price in the Claude line | see §4 |
| Music / SFX / voice | Stock (Pixabay/Pexels, free) by default; **ElevenLabs** Music, SFX and TTS as paid features | Licensed for commercial use | Music $0.30/min, SFX ~$0.12/gen [unverified], TTS $0.05–0.10 per 1k chars |
| Generative b-roll | **fal.ai** (Veo 3.1 Fast, Kling, Wan, FLUX images) | One API, many models | Veo Fast $0.10/s, Wan 720p $0.10/s, FLUX images $0.03–0.05 |
| Payments | **Stripe** Billing; Paddle or Stripe Managed Payments (merchant of record) when global tax matters | | 2.9 % + 30¢; MoR adds ~3.5 points |
| Monitoring | Sentry + PostHog | | free tiers at launch |
| Playback (optional) | Cloudflare Stream for adaptive HLS of outputs | | $5 per 1,000 min stored, $1 per 1,000 min delivered |

## 3. Rendering: the decision that drives cost
| Option | Cost per output minute (1080p) | Strengths | Weaknesses |
|---|---|---|---|
| **FFmpeg on Modal CPU (8 vCPU)** | ≈ $0.01–0.02 (≈1 min of 8-vCPU time per output minute) | Cheapest, fast, deterministic | Motion graphics are painful in filtergraphs |
| **Remotion Lambda** | ≈ $0.10–0.11 (Remotion's own remote-footage example) + licence | React components for captions/titles/3D, browser preview for free | 10× FFmpeg cost; AWS account needed; licence |
| Shotstack / Creatomate | $0.20/min (Shotstack PAYG); Creatomate ~37 credits/min at 1080p | No infra | Least control, highest cost |
| GPU (NVENC on L4) | ≈ $0.04/min | Sub-minute turnaround | Slightly worse quality per bitrate than x264 medium; only worth it at volume or for ML steps |

**Remotion licence**: free for individuals and companies of up to 3 people. A prompt-to-video product falls under "Remotion for Automators": **$0.01 per render with a $100/month minimum** once you are past the free threshold. Budget for it from the first paying month.

**Recommendation**: hybrid. Remotion for anything with graphics/captions (most jobs), driven by the EDL; FFmpeg for pure cut/concat jobs and for the final loudness-normalisation + platform-encode pass. Run Remotion on Modal (self-hosted renderer in a container) rather than Lambda if you want one vendor; benchmark both with a real recipe before choosing.

## 4. Claude costs and limits (official, 2026-10-25)
| Model | Input / MTok | Output / MTok | Cache read | Context |
|---|---|---|---|---|
| Opus 5.5 `claude-opus-5-5` | $4 | $20 | $0.20 | 1M / 128K out |
| Sonnet 5.5 `claude-sonnet-5-5` | $2 | $10 | $0.10 | 1M |
| Haiku 5.5 `claude-haiku-5-5` (≤100k prompt) | $0.10 | $0.50 | $0.01 | 1M |
| Fable 5.1 `claude-fable-5-1` | $10 | $50 | $0.25 | 1M |

- **Batch API is 50 % off** and combines with caching: use it for non-interactive work (bulk frame captioning, nightly recipe evaluations).
- **Claude does not accept video input.** Extract keyframes with FFmpeg and send images. Cost is ⌈w/28⌉×⌈h/28⌉ tokens per image: a 1280×720 frame ≈ 1,196 tokens; 20 frames ≈ 24k tokens ≈ $0.10 on Opus 5.5, $0.0024 on Haiku 5.5. Use the Files API so frames are not re-sent on every agent turn.
- **Rate-limit tiers and monthly spend caps**: Start $500, Build $1,000, Scale $200,000. At ~150 active users your LLM spend passes the Build cap; request a tier increase in the Console early.
- API behaviour to design for: Opus 5.5 has thinking always on (control cost with `output_config.effort`, default `medium`); forced `tool_choice` is rejected (use `auto` + `strict: true` tools or structured outputs); plan a `fallbacks: "default"` path for `refusal` stop reasons.

## 5. Cost per project
Assumptions: 5-minute 1080p output from 10 minutes of raw footage; 2 GB upload + 300 MB output kept 30 days on R2; Deepgram transcription; agent uses ~150k input tokens (60 % cache hits) and 15k output across ~8 turns; FFmpeg render on Modal.

| Line item | Lean | Standard | Premium |
|---|---|---|---|
| Transcription | $0.04 | $0.04 | $0.04 |
| LLM planning | $0.28 (Sonnet 5.5) | $0.56 (Opus 5.5) | $0.56 (Opus 5.5) |
| Music + SFX | $0 (stock) | $2.10 (ElevenLabs 5 min + 5 SFX) | $2.10 |
| AI b-roll | $0 | $0 | $1.00 (2 × 5 s Veo Fast) |
| Render | $0.10 (FFmpeg, incl. retries) | $0.10 | $0.55 (Remotion Lambda) |
| Storage (30 d) | $0.03 | $0.03 | $0.03 |
| **Total** | **≈ $0.46** | **≈ $2.83** | **≈ $4.30** |

Haiku 5.5 for frame captioning adds ~$0.01. Fable 5.1 as the planner would be ~$1.37 per project; not worth it for v1.

**Pricing implication**: a $19/month plan is comfortable at lean cost (gross margin > 85 % at 10 projects/month) and roughly break-even at standard cost. Therefore: stock music by default, AI music/b-roll metered as credits, previews free.

## 6. Monthly bill by scale
Active user = 4 projects/month. Ranges are lean / standard / premium variable cost plus fixed platform fees.

| Active users | Fixed platform | Variable (lean / standard / premium) | Storage | **Total** |
|---|---|---|---|---|
| 0 (building) | $0–60 (all free tiers, Modal $30 credit) | ~$0 | < 10 GB | **$0–60** |
| 100 | ~$120 (Vercel Pro, Supabase Pro, Sentry, Upstash, R2) + $100 Remotion licence | $180 / $1,130 / $1,720 | 0.9 TB | **$300–1,950** |
| 1,000 | ~$700 (adds Inngest Pro, Modal Team, Clerk/PostHog) | $1,830 / $11,300 / $17,100 | 9.2 TB | **$2,500–18,000** |
| 10,000 | ~$3,500 | $18,300 / $113,000 / $171,000 | 92 TB | **$22,000–175,000** |

At 1,000+ users: negotiate Deepgram/AssemblyAI growth plans, a licensed music library deal, and move steady render load to dedicated servers (Hetzner AX-class at ~€70–290/month each; GPUs discontinued on Fly.io since Aug 2026, so Modal/RunPod/Cloud Run are the GPU options).

## 7. Deployment runbook (v1)
1. Create accounts: Vercel, Supabase, Cloudflare (R2 bucket + CORS exposing `ETag`), Anthropic Console (add payment, request Build tier), Deepgram, ElevenLabs, Inngest, Modal, Stripe, Sentry, PostHog.
2. Repo: GitHub → Vercel auto-deploys `main` to production and every branch to a preview URL.
3. Secrets in Vercel env vars and Modal secrets; never in the repo.
4. Supabase migrations in the repo (`supabase/migrations`), applied in CI.
5. Modal functions deployed from CI (`modal deploy`), versioned with the app.
6. Inngest cloud connected to the Vercel deployment via its serve endpoint.
7. Stripe webhooks → Vercel route → ledger updates; test with the Stripe CLI.
8. R2 lifecycle rules: delete raw footage 30 days after project completion (free tier) / 90 days (paid), keep EDL and renders.
9. Status page (Betterstack free) and uptime checks on the render pipeline.
10. Region: pick one (US-East or EU-West) for Vercel functions, Supabase, Modal and R2 to keep latency and egress low.

## 8. What to measure from day one
Per project: tokens and cache hits per Claude call, seconds of CPU per render, bytes stored, media API spend. Roll up to **gross margin per paid minute**; target ≥ 70 %.
