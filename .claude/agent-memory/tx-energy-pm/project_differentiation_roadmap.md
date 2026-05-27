---
name: project-differentiation-roadmap
description: Post-MVP 12-week sequencing to differentiate from ComparePower; ordered by moat foundation dependency
metadata:
  type: project
---

Post-MVP differentiation sequence (decided 2026-05-27, after Week 2 ship):

1. **Weeks 3-4: True Cost Calculator + EFL gotcha extraction.** Replace headline-rate sort with projected-12-month-cost sort. Model bill-credit cliffs and base charges. Add "trap" badges.
2. **Weeks 5-6: Renewal-alert capture + email pipeline.** Capture contract end date at handoff; Resend + cron sends 45/30/15-day reminders with fresh comparison.
3. **Weeks 7-9: Bill upload v1.** Vision API extracts 12-month kWh curve; re-rank plans against user's actual curve. Store parsed bills as dataset moat.
4. **Weeks 10-11: REP Trust Scores + programmatic SEO.** Scrape PUCT complaints, BBB; compute trust score. Generate 500+ ZIP/REP landing pages.
5. **Week 12: Spanish v1 + funnel instrumentation.** Full Spanish UX + renewal emails; EPC measurement by traffic source.

**Why this order:** True-cost calc must precede bill upload (no point feeding a personalized curve into a flawed ranker). Renewal-alert capture is week 5 because every delayed week loses a cohort of un-captured handoffs. SEO is started early because it has a 6-18 month lead time.

**How to apply:** When the user proposes adding a new feature post-MVP, check whether it's in this sequence or competes for the slot. Push back on out-of-sequence work unless there's a specific reason (e.g., a partnership opportunity, a bug, a regulatory change). Related: [[project-moat-strategy]], [[project-monetization]].
