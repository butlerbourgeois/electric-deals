---
name: project-mvp-constraints
description: Locked MVP constraints — aggregator-first monetization, manual entry only, BD-constrained launch path
metadata:
  type: project
---

Three binding constraints set by founder on 2026-05-26 for the v1 MVP:

1. **BD constraint**: No direct REP relationships yet. Cannot rely on TXU/Reliant/Gexa/etc. for affiliate deals at launch.
2. **Monetization**: Aggregator networks (ChooseEnergy, PowerSetter, SaveOnEnergy/Allconnect partner network) as the sole revenue path for MVP. Migrate to direct REP affiliate contracts once volume proof exists (target: 500+ monthly enrolled leads).
3. **Bill ingest**: Manual entry only for MVP (user types kWh or average monthly bill). OCR/bill upload is Phase 2 once core funnel proves out.

**Why:** Founder wants to ship in 6 weeks and validate the funnel before sinking time into REP BD or OCR engineering. Aggregator routing means we can launch with zero REP contracts. Manual entry means no ML/vision risk on the critical path.

**How to apply:**
- Do NOT propose features that require direct REP API access, EDI feeds, or enrollment-side integration in the MVP.
- Do NOT propose OCR, computer vision, or bill-parsing work in Sprints 1-6.
- DO propose features that build the [[project-moat-strategy]] data moat (usage profiles, preference signals) even on the manual-entry path — these become the OCR training data later.
- All "best plan" recommendations must terminate in an aggregator handoff URL, not a native enrollment flow (avoids most [[project-compliance]] enrollment-flow regulation in v1).
