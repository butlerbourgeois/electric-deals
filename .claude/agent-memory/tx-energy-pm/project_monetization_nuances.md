---
name: project-monetization-nuances
description: EPC optimization tactics beyond base aggregator commissions — direct REP deals, tie-breaking, dropped-enrollment recovery
metadata:
  type: project
---

Monetization nuances layered on top of the base affiliate model (see [[project-monetization]]):

- **Direct REP partnerships at scale.** Once enrollments for a specific REP exceed ~50/month, reach out to the REP's partnerships contact directly. Direct deals typically pay 1.5-2x aggregator rates. Track enrollments-by-REP so this trigger is automated.
- **Commission as tie-breaker, never ranker.** Sort by true cost. Among comparable top-5 plans, break ties by commission and give higher-paying plans more prominent card treatment (badges, screen area). Do not reorder by commission.
- **Plan-level commission variance within a REP.** Commission rates vary plan-by-plan within the same REP. Feed this into tie-breaking logic.
- **Dropped-enrollment recovery email.** If we captured email pre-handoff and the enrollment didn't confirm within 24h, send a follow-up. ComparePower structurally cannot do this — they don't capture email pre-handoff.
- **B2B data licensing as second revenue line.** De-identified usage curves are valuable to REPs for pricing/marketing research. Same dataset moat as the consumer product. Prefer this over the consumer premium tier from [[project-monetization]] — actively drop premium-tier from roadmap.
- **Multi-vertical readiness.** Don't build now, but keep `quote`, `provider`, `commission_event` polymorphic so adding gas/internet/insurance later is config not rewrite.

**Why:** Solo-dev resources mean we cannot win on volume of plans or REP relationships. We can win on EPC by being smarter about which dollar-per-click we extract from each user we already have.

**How to apply:** When the user asks "how do we make more money," default to EPC-lift tactics from this list before recommending new traffic acquisition. Acquisition costs scale linearly; EPC lifts compound across the entire funnel.
