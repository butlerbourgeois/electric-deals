---
name: project-week1-scope
description: Week 1 build scope locked 2026-05-26 — scaffolding, schema, PTC ingestion, ZIP+usage capture form, no quote ranking yet
metadata:
  type: project
---

Week 1 build scope (locked 2026-05-26) covers four task groups: (1) GitHub repo + Next.js/Supabase/Vercel scaffolding, (2) DB schema with 7 tables (provider, plan, zip_tdu, usage_profile, quote, enrollment_handoff, ingest_run) and ZIP→TDU seed, (3) PTC scraper writing to `plan` table with daily idempotent upserts, (4) `/start` flow with ZIP→TDU resolution and dual-path usage entry (kWh OR $+sqft), plus cost calculator in `@electric-deals/core-logic`. Quote ranking and the comparison UI are explicitly Week 2.

**Why:** Founder wants 6-week MVP ship targeting ~2026-07-07 ([[project_mvp_constraints]]). Week 1 is the foundation — getting plan data flowing and usage capture working unblocks every downstream feature. Pushing quote ranking to Week 2 keeps Week 1 scope honest.

**How to apply:** When the user asks about Week 1 progress or scope creep, refer to this. When they ask "what's next?" after Week 1 ships, the answer is quote-generation engine + comparison UI reading from the `quote` table. If they ask about bill-upload OCR, that's still Phase 2 — Week 1 only has the manual-entry foundation ([[project_moat_strategy]]).

**Key architecture decisions made in this plan:**
- Monorepo via pnpm workspaces with `apps/web`, `packages/db`, `packages/core-logic` — even though only web is built in Week 1, the packages are scaffolded so cost calculator and DB types are shared from day one.
- Plans are TDU-scoped, not ZIP-scoped (one PTC query per TDU returns full coverage — ~5 requests vs ~1,800).
- Anonymous usage profiles via session_id cookie, merged to user_id on later signup.
- Linear interpolation between PTC's 500/1000/2000 kWh anchor points is the MVP calculator approach; full EFL parsing is deferred to Phase 2 as a future accuracy moat.
- Austin/San Antonio handled as `tdu_id='NON_DEREGULATED'` sentinel with capture-email fallback page.
