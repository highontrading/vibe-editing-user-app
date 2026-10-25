# 02 — Product Specification

Working name: **Vibe Editor** (rename later). One-line pitch: *Upload your footage, describe the video you want, get a finished, platform-ready edit in minutes — captions, music, sound design, motion graphics and effects included — and tweak anything with a sentence or a drag.*

## 1. Who it is for
| Segment | Job to be done | Why they pay |
|---|---|---|
| Creators (TikTok/Reels/Shorts, YouTube) | Post daily without spending 2–4 h editing | Consistency = growth = income |
| Founders / indie hackers | Product demos, launch videos, talking-head updates | No editor on payroll |
| Podcasters | Turn a 60-min episode into 10 clips | Distribution |
| Agencies / UGC creators | Volume: 20–50 ads per week in different styles | Throughput per editor |
| Coaches / educators | Explainers, course promos | Look professional fast |

Launch wedge: **short-form talking-head and vlog content** (highest volume, most formulaic, where AI editing already looks great). Expand to long-form and product/ads after.

## 2. Core user flow (mirrors and improves on the reference)
1. **Home**: big prompt box "Describe your video, or drop footage…", upload button, aspect-ratio selector (Auto / 9:16 / 16:9 / 1:1 / 4:5), quick-style chips (Montage, Vlog, Talking-head, Explainer, Product demo, Ad/Promo, Launch video). Below: *Recipes* (browsable gallery grouped by category with video previews on hover) and *Your projects*.
2. **Upload**: drag-and-drop multiple files (up to tens of GB), paste a YouTube/Drive link, or pick from the Asset library. Uploads continue while the user writes the prompt. Show "analysing footage" progress.
3. **Brief**: user prompt + optional recipe + optional reference video + brand kit. The agent replies with a short **plan** ("Here's what I'll do: hook in first 2 s, 14 jump cuts, captions in Bold Pop, lo-fi bed, 3 whooshes") that the user can approve or adjust before rendering.
4. **Draft**: instant browser preview of the EDL (no server render yet). Chat panel on the left to iterate: "make the intro faster", "swap the music to something cinematic", "add a lower third with my name", "remove the part where I cough".
5. **Timeline**: a real but simple multi-track timeline under the preview: trim, split, reorder, mute, swap caption style, drag SFX. Every AI change is a version the user can roll back.
6. **Export**: platform presets, resolution (720p free / 1080p / 4K), with/without captions burned in, SRT download, thumbnail generation, share link for feedback.
7. **Remix**: one click to re-cut the same project for another platform/aspect ratio or another recipe.

## 3. Feature list (v1 = launch, v2 = after launch)
**Editing intelligence (v1)**
- Silence and filler-word removal; sentence-boundary jump cuts; punch-in zooms; pacing control by recipe.
- Hook detection: pick the strongest 2–3 s for the opening.
- Word-by-word animated captions (10 styles at launch), emoji and keyword highlighting, auto-correct of transcript with user dictionary.
- Background music (generated or licensed library) with automatic ducking under speech; SFX on cuts/titles; loudness normalisation.
- Titles, lower thirds, kinetic text, progress bars, call-to-action end cards — all as parameterised Remotion components.
- Colour presets, film grain, light leaks, speed ramps, shake/zoom transitions.
- Auto-reframe for vertical (face tracking) and smart cropping.
- Stock b-roll insertion from Pexels/Pixabay matched to the transcript.

**Editing intelligence (v2)**
- Generated b-roll (image → video), AI voice-over and voice clean-up, dubbing/translation, multi-cam switching, long-form clipping with virality scoring, screen-recording-aware product demos (cursor zoom, click highlights), reference-video style transfer.

**Platform**
- Projects, asset library, versions, share/review links with comments, brand kits, team workspaces (v2), public API (v2), desktop app (v2).

## 4. How we beat cardboard.ai (positioning)
*(Factual gaps are detailed in `01-cardboard-competitive-analysis.md`; this is the strategy.)*
Cardboard already has a real timeline, chat checkpoints, agent self-verification, recipes and reference remixing, so none of those are differentiators on their own. We win on the things their users complain about and the things their architecture (client-side rendering, Mac-only local processing) makes hard:

1. **Predictable pricing.** Minutes-based credits, a cost estimate shown *before* each agent run, hard budgets, free previews and re-edits. Credit anxiety is Cardboard's #1 complaint.
2. **Plan-before-render.** The agent shows a shot list / beat plan the user approves before it spends credits. Users on Hacker News asked Cardboard for exactly this.
3. **Server-side rendering with instant browser preview.** No Chrome memory crashes, no 2.5/10 GB file caps, consistent output quality, works on Windows, Linux, Chromebooks and phones. Cardboard renders in the browser and only processes locally on Apple Silicon.
4. **Audio quality as a feature.** Loudness normalisation, ducking, *generated* SFX and music (Cardboard only picks library tracks).
5. **Deterministic QA.** Caption safe zones, loudness, duration targets and platform specs shown as green ticks on every export.
6. **Ingest and publish anywhere.** YouTube/Drive/Dropbox import and direct publishing + scheduling with an analytics loop. Cardboard has neither.
7. **Brand memory and an open recipe system.** Brand kits, per-client presets, learning from past edits; user-created recipes that can be shared and later sold. "Memory" is on Cardboard's own unsolved-problems list; their recipes are first-party only.
8. **API/MCP-first.** A public API and MCP server for agencies and agent builders from day one of v2.

## 5. UI direction
- Dark, cinematic, calm. Serif display headline ("Let's cut your product demo, podbot"), sans body. Generous whitespace. Thumbnail-led browsing with hover-to-play.
- Editor layout: chat (left, 320 px) · preview (centre, fills) · inspector (right, 300 px) · timeline (bottom, 220 px, collapsible).
- Keyboard-first: space play/pause, J/K/L, I/O in-out, Cmd+Z, Cmd+Enter to send prompt.
- Motion: subtle, 150–250 ms, never blocking. Skeletons and optimistic UI everywhere.

## 6. Pricing (proposed, to validate)
| Plan | Price | Includes |
|---|---|---|
| Free | $0 | 10 min of export/month, 720p, watermark, 3 projects |
| Creator | $19/mo ($15 annual) | 120 min/month, 1080p, no watermark, all recipes, 20 GB storage |
| Pro | $49/mo ($39 annual) | 400 min/month, 4K, AI b-roll + voice credits, brand kits, priority rendering, 200 GB |
| Studio | $149/mo | 1,500 min, 5 seats, API, shared libraries, 1 TB |
| Overage | $0.20 per extra minute | |

Credits are debited on *export minutes*, with multipliers (4K ×2, generated video b-roll ×5). Previews and re-edits are free so users iterate without fear.

## 7. Success metrics
- Time-to-first-export < 10 min from signup. 
- ≥ 40 % of first exports downloaded without any manual timeline edit (AI quality proxy).
- Free→paid conversion ≥ 4 %; monthly churn < 6 %.
- Gross margin per paid minute ≥ 70 % (track Claude + render + media API spend per export).
