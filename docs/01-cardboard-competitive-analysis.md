# 01 — Cardboard.ai Competitive Analysis

Research date: 2025-10-25. Compiled from the official site (cardboard.ai/, /pricing, /changelog, /desktop, /hard-problems, /terms, /careers), the older usecardboard.com changelog, learn.usecardboard.com docs, status.cardboard.ai, the YC company page, the Hacker News launch thread, the Product Hunt launch, and ~15 third-party reviews/pricing trackers. Items marked **[unconfirmed]** come from secondary sources or conflict between sources.

## 1. What Cardboard is
- Official positioning: *"agentic AI video editor in your browser and on your Mac. Describe your edit and Cardboard cuts, captions, reframes, and composes it."* Tagline used in launches: **"Cursor for video editing."**
- Target: growth/marketing teams and serious creators who ship video consistently. Give it footage and a goal ("3 variants", "30s hook") and get a first cut in minutes.
- Explicitly *not* competing on long-form narrative film, pro colour grading, VFX, broadcast work.
- Company: YC W26. Founders Saksham Aggarwal (CEO, creator background) and Ishan Sharma (CTO, ex-HackerRank). Team ~8–11 (Bengaluru + SF). Funding: YC standard; ~$2.1M seed reported **[unconfirmed]**.
- Timeline: first release Nov 9 2025 → YC launch Feb 2026 → Launch HN Feb 26 2026 (132 pts) → Product Hunt Mar 11 2026 (#2 of the day) → usage-based pricing Jun 2026 → Mac app + "bring your own agent" Sep 28 2026 → Recipes Oct 13 2026.
- Velocity: **46 numbered releases in 11 months, ~1 per week.** This is the thing to respect most.

## 2. Feature inventory (confirmed)
**The agent ("The Director")**
- Chat panel with persistent conversations, multiple tabs, a **model picker**, a message queue, and per-message **checkpoints** (roll the timeline back to any chat message).
- The agent does not generate pixels; it emits tool calls that *diff the timeline* (add_clip, trim_clip, remove_silence, sync_to_beats, add_captions…). Same architecture we plan (EDL as the contract).
- **"Agent eyes"** (Jul 2026): after a change, the agent looks at rendered frames and fixes problems (e.g. caption sliding off-screen) before handing back.
- **Bring Your Own Agent** (Mac only, Sep 2026): connect your paid Claude or ChatGPT plan; Cardboard supplies footage, timeline and tools; your subscription pays for the thinking. Zero marginal LLM cost for them on those users.

**Footage understanding**
- Transcription (English first; Mandarin added Sep 2026), word-level timestamps.
- "AI Vision" keyframe indexing with a VLM; semantic search of footage in plain language ("find the shot where she laughs"). Reported to use Claude Sonnet 4.6 for this **[secondary source]**.
- Shot detection, beat detection (percussion), face/speaker detection.

**Editing primitives**
- Full multi-track NLE timeline in the browser, keyframes, transitions, blur, ripple delete, snapping, Premiere/FCP keyboard maps.
- Silence/dead-take/repetition removal, transcript highlight finding, beat-synced cuts.
- Captions: animated, stacked, presets, trending fonts, on-canvas text toolbar (font/weight/colour/shadow).
- Reframe: vertical/square/landscape with speaker tracking, speaker grid layouts, batch "Reframe Every".
- Audio: cleanup ("Perfect Audio"), ducking, library music picked by the AI to match cadence. Music *generation* **[unconfirmed]**.
- Voice: 10 preset AI voices, voice cloning, parameters (stability/similarity/style) that match ElevenLabs **[inference]**.
- Colour: numeric colour controls; ProRes and Dolby support; effects previewed on your own footage.
- Generative media via "generative credits": Hailuo, Kling 2.5/3, Seedance 2.5, Veo, image gen; 3D scenes (Oct 2026); subject cutouts; editable graphics; web-sourced b-roll (Creator+).
- References: paste a link to a video you like and remix its style. Recipes (Oct 2026): finished edits you remix with your own footage; each states what footage to bring, sizes, and whether it uses generative credits.
- Recipe categories seen on the site: Product Showcases, Viral Trends, Launch Videos, UGC Ads, Explainers, Vlogs, Podcast Clips (the screenshot also shows UGC, Clipping, Vlog, Effect, Viral trends, Travel montage, Product showcase, Aftermovie, Explainer, Talking-head).

**Collaboration, storage, export**
- Share links for review; "sharing with team" on paid plans; real-time collaboration and version control are listed by them as *unsolved hard problems*.
- Cloud backup of projects; browser-side OPFS storage for media.
- **Rendering is client-side** (WebCodecs + WebGL2 in Chrome; Edge for export). Mac app renders locally. No server render farm = very low COGS, but it pushes memory/perf problems onto the user's machine.
- Exports: MP4 1080p (Lite/Starter) or 4K (Creator/Pro), GIF, XML/FCPXML handoff to Premiere, Final Cut, DaVinci (with relink, timecode, bundled assets).
- No direct publishing to social platforms, no import from YouTube/Instagram/Drive (founder confirmed). No Windows/Linux app, no mobile. Upload caps 2.5 GB/file (lower tiers) and 10 GB (Pro); Mac app avoids upload entirely.
- "Desktop" badge on recipes: best reading is that the recipe needs the Mac app (local processing / any-codec ingest / BYO agent) **[inference]**.

## 3. Pricing (official page, Oct 2026; "launch pricing, up to 78% off first month")
| Tier | Monthly | List | Usage multiplier | Generative credits | Exports | Notes |
|---|---|---|---|---|---|---|
| Lite | $8 | $10 | standard | none | 3 exports/mo, 1080p, **watermarked** | **Free inside the Mac app** (local processing). Includes Director, BYO agent, captions, audio cleanup, reframe, reference edits |
| Starter | $29 | $40 | 2.5× | 400 (base models: Hailuo, Kling 2.5, image) | unlimited 1080p, no watermark, NLE exports | team sharing |
| Creator | $59 | $100 | 10× | 1,500 (premium: Kling 3, Seedance 2.5, Omni, Veo) | 4K | voice cloning, web b-roll |
| Pro | $175 | $250 | 30× | 5,000 (all models) | 4K | priority processing, early access |

- Two currencies: **usage credits** (agent/GPU analysis) and **generative credits** (AI video/image). The exact credit→minute mapping is not published **[unconfirmed]**. Annual plans not seen. No enterprise tier.
- Pricing has been restructured **three times in ten months** ($60 Creator / $150 Pro → usage-based from $32 → Lite/Starter/Creator/Pro). Third-party sites show contradictory numbers.
- Refunds: 14 days if unused (ToS). Purchases via Apple ID / Google / Cardboard account.

## 4. Changelog highlights (shows what they consider important)
2025: Initial release (Nov 9), faster playback, transitions, transcription, AI Vision, keyframes.
2026 Q1: voiceover, voice cloning, sentence search, stacked captions, new timeline, layouts, export options, chat checkpoints, GIF export, faster exports, Edge export, Director overhaul + model picker, Perfect Audio.
2026 Q2: cloud processing, DaVinci export, speaker grid, subscription offers, smoother/speaker reframes, smarter search, faster AI, Reframe Every + beat sync + usage-based pricing, trending fonts + message queue, "Real Footage".
2026 Q3: share links, keyframes/blur/shortcuts, **Agent eyes**, References, exact colour/ProRes/Dolby, new sidebar, Footage First, "Fewer Surprises", Canvas Text, fast scrubbing/editable graphics, reliable exports + Mandarin + 200 GB projects, **Mac app + BYO agent**.
2026 Q4: Any Footage + cutouts + 3D graphics, **Recipes**.

## 5. Tech stack (evidence-based)
- Frontend/renderer: TypeScript, custom WebCodecs + WebGL2 renderer, OPFS storage, GLSL shaders. Founder explicitly contrasted with Remotion ("Remotion is for developers; Cardboard for non-devs").
- Backend: TypeScript + Python, FFmpeg, GPU analysis + transcription + VLM keyframe indexing in the cloud; Mac app does it locally.
- Models: multi-model (picker), Anthropic + OpenAI integrations confirmed via BYO agent. Generative partners: MiniMax Hailuo, Kling, Seedance, Veo. Voice likely ElevenLabs.
- Evals: hiring an "Evals & Data" ML engineer; wants to tie a verifier to social engagement data (an RL loop on real performance).
- Status page: Exports component at 96.9 % 30-day uptime (~22 h downtime).

## 6. What users praise
- Client-side rendering is technically impressive; good onboarding/UI; NLE handoff makes it a complement to Premiere/Resolve; multicam for podcasts works well; fast shipping.

## 7. What users complain about (our opportunity list)
1. **Credit burn and anxiety**: chat drains credits quickly, no visible cap, two credit types, three pricing changes. Users asked for a cheaper consumer option.
2. **Memory/performance**: Chrome crashed on an M4 MacBook with 24 GB; choppy scrubbing. Browser rendering limits pro quality (sub-pixel text AA, jitter).
3. **Export reliability** (status page) and mid-render failures (they shipped recovery for it).
4. **File limits** (2.5/10 GB) hurt ProRes/RAW users.
5. **No undo after AI edits** (now fixed with checkpoints) — proves users want control over AI changes.
6. **Platform lock-in**: Chrome-only web, Apple-Silicon-only app, no Windows, no mobile.
7. **No URL/cloud ingest** (YouTube, Drive, Dropbox) and **no direct publishing/scheduling**.
8. **Agent reliability**: "agents still need a lot of guidance"; an HN user asked for a *plan mode*.
9. **Maturity**: reviews call it early-stage; motion graphics, memory, collaboration, version control, style references are on their own "hard problems" list.

## 8. Competitor snapshot (verify prices on official pages before quoting)
| Product | Price range | Positioning | Weak spot |
|---|---|---|---|
| Descript | Free → $24–65/mo | Transcript editing + "Underlord" agent; podcasts | Agent over-promises, confusing credits, freezes on big projects |
| Opus Clip | Free → $15–29/mo | Long-form → shorts with virality score | Expensive per minute, failures, credits expire |
| Captions / Mirage | Free → $10–280/mo | Talking-video polish, avatars, mobile | Uncanny avatars, renames, export failures |
| VEED | Free → $19–49/mo | Browser all-rounder for marketers | Generic AI, manual timeline work |
| CapCut | Free → $20/mo | Mass-market mobile + desktop | Weak generative quality, privacy concerns |
| Runway / Pika | Free → $15–95/mo | Generative video, not an NLE | Credits vanish, short clips |
| Kapwing | Free → $24–64/mo | Collaborative browser editor | Watermark, per-seat |
| Submagic | Free → $19–69/mo | Best animated captions + b-roll for shorts | Hard duration caps |
| InVideo AI | $20–900/mo | Prompt → stock/generative video | Slideshow feel, not your footage |
| HeyGen / Argil | Free → $29–499/mo | Avatars, dubbing, UGC clones | Uncanny, expensive per minute |
| Agentic rivals | Valmera, Tellers, Wideframe, Diffusion Studio, mstudio, Palmier, Tella | "Cursor for video" clones | All early |

## 9. Opportunities ranked by (user pain × feasibility)
1. **Predictable pricing**: minutes-based credits, a cost estimate *before* each agent run, hard budgets, free previews/re-edits, rollover. Direct hit on their #1 complaint.
2. **Plan-before-execute**: the agent shows a shot list / beat plan the user approves. Saves credits, builds trust, answers the HN ask.
3. **Server-side rendering with instant client preview**: no browser memory crashes, no 10 GB caps, consistent quality (proper text AA), works on Windows/Linux/Chromebooks and phones. Costs us COGS; see `04-infrastructure-and-costs.md`.
4. **Audio as a feature**: loudness normalisation, ducking, generated SFX/music (they only pick library music).
5. **Deterministic QA checklist**: caption safe zones, loudness, duration targets, platform specs, shown to the user as green ticks.
6. **URL/cloud ingest + direct publishing + analytics loop** (none of it exists at Cardboard).
7. **Brand memory**: brand kits, per-client caption presets, learning from past edits ("Memory" is on their unsolved list).
8. **Batch clipping with virality scoring** for podcasters (Opus/Submagic territory, Cardboard weak).
9. **Recipe marketplace** (user-created, shareable, later sellable). Their recipes are first-party only.
10. **Public API / MCP server** for agencies and agent builders (they only allow BYO agent inside the Mac app).
11. **Avatars/UGC presenters** combined with real-footage editing (they have none despite a "UGC Ads" category).
12. **Annual plans, team seats, enterprise** (none visible).

## 10. What to respect and copy
Weekly shipping cadence with a public changelog; chat checkpoints; agent self-verification with vision; recipes with "what to bring"; reference-video remix; NLE handoff exports; a real timeline next to the chat; a model picker and BYO-agent as a cost lever.
