# 06 — Risks, Legal and Compliance

## 1. Is this a good idea? (honest assessment)
**Yes, with a caveat.** Demand is real: every creator, founder and agency needs more video than they can edit, and AI editing (Cardboard, Descript, Opus Clip, Submagic, Captions) already converts. The caveat is that this is a crowded, fast-moving category where a YC-backed competitor ships weekly. You win by being *narrower and better* at launch (short-form talking-head and vlog edits that look finished), by making pricing and the agent's plan transparent, and by a visual-quality bar (captions, titles, audio) that beats theirs. You do not win by matching their 46 features on day one.

Biggest risks, in order:
1. **Quality bar**: if the first edit a user sees is mediocre, they leave. Mitigation: 5 recipes done brilliantly, self-review loop, motion-design contractor early.
2. **Unit economics** if AI music/generative b-roll are unlimited. Mitigation: credits for anything that costs you money, previews free.
3. **Competitor velocity**: Cardboard ships weekly and has BYO-agent (users' own Claude plans pay for inference). Mitigation: ship weekly too, public changelog, and consider BYO-Claude as a cost lever later.
4. **Solo-founder bandwidth**: motion components, agent prompts and infra are three jobs. Mitigation: phases in `05-build-roadmap.md`; Claude Code for glue code; contract design.
5. **Platform dependency**: model prices/behaviour, API deprecations. Mitigation: EDL abstraction so the model is swappable; pin model IDs; eval set of 30 golden projects.

## 2. Music and media licensing
- Consumer subscriptions to Epidemic Sound, Artlist, Soundstripe **do not** allow a platform to embed tracks for its users. You need a platform/enterprise deal or an API vendor whose terms cover sublicensing.
- **ElevenLabs Music** is licensed (Merlin/Kobalt) and allows commercial use from paid tiers; film/TV/games require Enterprise.
- **Suno and Udio have no official API**; third-party wrappers violate their terms, and UMG/Sony litigation and a German GEMA ruling remain open. Don't build on them.
- **Pexels** (free API) requires a visible link to Pexels and photographer credit. **Pixabay** requires 24-hour caching, no hotlinking (download to your storage), source attribution, no bulk downloads. Neither allows building a competing stock library.
- Store provenance metadata for every track/clip/image and show it to users in an "assets used" panel.

## 3. User-uploaded content
- **DMCA safe harbour (US)**: register a designated agent with the Copyright Office ($6, renew every 3 years), publish a takedown and repeat-infringer policy.
- **Moderation**: scan uploads and prompts. Free: OpenAI omni-moderation (text + image); Cloudflare's CSAM scanning tool is free for any Cloudflare zone. Paid: Hive ($3 per 1k images), Sightengine (from $29/mo).
- Block requests for celebrity voices/faces; mirror Anthropic, ElevenLabs and Veo content/likeness rules in your ToS. Anthropic's usage policy forbids identifying people in images.

## 4. Privacy (GDPR and friends)
- Footage of people is personal data. Define retention: raw footage auto-deleted N days after project completion (R2 lifecycle rules), immediate deletion on account closure, export + delete endpoints.
- Sign DPAs and publish a sub-processor list (Anthropic, Deepgram/AssemblyAI, ElevenLabs, Cloudflare, Vercel, Supabase, Modal, Stripe).
- Anthropic retains API data 30 days by default; zero-data-retention is available for eligible orgs (not on Fable 5.1).
- Offer an EU region option later (Supabase + R2 jurisdiction + `inference_geo`).

## 5. Payments and tax
- Selling globally triggers VAT/GST obligations. A merchant of record (Paddle 5 % + 50¢, Stripe Managed Payments +3.5 points) removes that for a few points of margin. Reasonable to start with plain Stripe + Stripe Tax if most customers are in one or two countries.
- 14-day refund policy if unused (Cardboard does this); clear credit expiry and rollover rules to avoid the credit-anxiety complaints Cardboard gets.

## 6. Desktop app (later)
- macOS: Developer ID signing + notarisation (Apple Developer Program $99/yr). Windows: signed binaries for SmartScreen (Azure Trusted Signing $9.99/mo for eligible entities, else OV/EV certs $130–400/yr).

## 7. Operational risks
- Export reliability is a visible weakness at Cardboard (96.9 % uptime on exports). Build retries, resumable renders and a status page from day one.
- Anthropic monthly spend caps per tier (Start $500, Build $1,000); request increases before launch marketing.
- Keep an eval set of golden projects and run it on every prompt/model change so quality doesn't silently regress.
