---
name: project-weeks-3-4-scope
description: Locked Weeks 3-4 scope (2026-05-27) — finish true-cost ranking, model bill-credit cliffs, ship Gotcha badges, extract EFL gotchas
metadata:
  type: project
---

Weeks 3-4 (post-MVP, sprint after [[project-week2-scope]]) — locked 2026-05-27 for the true-cost + gotcha layer.

**Why:** This is the first slice of the differentiation roadmap ([[project-differentiation-roadmap]]). The bet is that surfacing bill-credit cliffs and hidden fees as warnings — at the moment of comparison — is the moat that separates us from ComparePower's "lowest headline rate wins" UX. We already ingest enough EFL/component data to compute these; we just haven't surfaced them.

**Scope (locked):**
1. Replace headline-rate sort with projected 12-month cost (audit + finalize — calculator already does this, but verify ranking endpoint uses annual cost not headline rate)
2. Improve bill-credit cliff modeling — current model treats credit as binary at threshold; need to detect and warn on cliffs where a small usage drop wipes out hundreds of dollars
3. Build Gotcha badges system (data model + extraction + display): "rate doubles below threshold", "high ETF relative to savings", "base charge hidden in headline rate", "bill-credit cliff", "teaser rate that resets"
4. EFL parser/extractor — pull billing breakpoints from EFL PDF/HTML where available; for now use structured component data we already have, defer full EFL PDF parsing

**Out of scope (defer to Week 5+):**
- Bill upload OCR (Week 7-8 per [[project-differentiation-roadmap]])
- Renewal alerts
- Real-time EFL PDF parsing (only structured component-derived gotchas for now)

**How to apply:** When the senior-dev agent picks up Weeks 3-4 tasks, anchor every implementation choice to "does this make it harder for ComparePower to copy us?" Gotcha extraction is the moat. Calculator polish is table-stakes. Don't let the team spend Week 3 perfecting the calculator and skip the gotchas.
