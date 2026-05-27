---
name: project-week2-scope
description: Week 2 MVP scope locked 2026-05-27 — wire compare flow to live DB, ship enrollment-handoff attribution, real PTC data via ComparePower API
metadata:
  type: project
---

Week 2 scope, locked 2026-05-27. Five-day plan, four parallelizable groups.

**Goals shipped by end of week:**
1. /compare reads plans from Supabase (no MOCK_PLANS array).
2. Anonymous session-tracked usage_profile + quote rows persisted.
3. /api/handoff/[quoteId] route records enrollment_handoff with sub_id (revenue attribution layer is live).
4. /plans/[id] server-rendered detail pages (SEO foundation).
5. ZIP lookup hits zip_tdu table with static fallback.
6. Real PTC plan data ingested — primary path is the ComparePower public API (api.comparepower.com/api/plans), fallback to scraping the PTC results page with Playwright. Keep the mock generator as last-resort dev seed.

**Why:** Week 1 over-delivered on scaffolding/UI. The core gap is that nothing is persisted and nothing is attributable to revenue. Without enrollment_handoff and quote persistence we have no data moat and no monetization signal. PTC's authenticated API blocked us — ComparePower exposes the same dataset publicly without cookie gates.

**How to apply:** Treat data-layer wiring (group A) as the unblocker for everything else. The PTC ingestion fix (group D) can run in parallel because it writes to the same plan table the UI reads from. Plan detail page (group C) depends on plans being in the DB; if group A slips, scaffold the page against a single hand-inserted plan row.

Cross-ref: [[project-mvp-constraints]], [[project-week1-scope]], [[project-moat-strategy]], [[project-monetization]], [[project-compliance]].
