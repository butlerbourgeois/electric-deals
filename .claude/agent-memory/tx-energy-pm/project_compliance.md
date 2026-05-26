---
name: project-compliance
description: PUCT and TCPA compliance items that need legal review before public launch
metadata:
  type: project
---

Compliance items requiring legal review before any public launch:

1. **PUCT REP marketing rules** — any representation of plan pricing, terms, or rankings must match the REP's official EFL (Electricity Facts Label). Misleading marketing is enforced.
2. **EFL display requirements** — must link to or display the official EFL for every plan shown.
3. **TCPA / phone enrollment** — if we collect phone numbers and pass to REPs or sales floors, written consent and disclosure language is required.
4. **Affiliate disclosure** — FTC requires clear disclosure that we earn commissions on enrollments.
5. **Data privacy** — Texas Data Privacy and Security Act (TDPSA) effective 2024 governs personal data handling. Bill uploads contain PII (name, address, account number) and must be handled accordingly.
6. **Plan data freshness** — stale plan data shown as current is both a UX and a regulatory risk. SLA on data freshness should be tracked.

**Why:** PUCT can fine REPs whose affiliates mislead consumers. REPs will drop us as a partner if we create regulatory exposure. Compliance is not optional — it's a precondition for affiliate revenue.

**How to apply:** Flag any feature that touches plan representations, enrollment flows, phone/email capture, or pricing claims as requiring legal review. Build an EFL-link requirement into the Plan data model.
