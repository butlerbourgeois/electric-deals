---
name: project-north-star
description: The core product thesis for the TX electricity deal-finding SaaS
metadata:
  type: project
---

Greenfield SaaS that helps Texas residents (and eventually small businesses) find cheaper electricity plans. Core user flow:
1. User enters ZIP + usage manually OR uploads a recent bill (or multiple) for OCR/parsing
2. Platform builds a usage profile (kWh by month, seasonal shape, current rate)
3. Platform searches REP plans matching ZIP, TDU, and contract preferences
4. Platform ranks by *true annualized cost on user's actual usage curve* — not by 1000 kWh rack rate
5. Platform facilitates enrollment via affiliate/lead-gen partnerships

**Why:** PowerToChoose ranks by sticker price at 500/1000/2000 kWh — which routinely misleads consumers because real plans have bill credits, tiered rates, and TDU passthroughs that distort actual cost at the user's real usage level.

**How to apply:** Every feature decision should be tested against "does this improve the accuracy or trust of personalized cost estimates?" If not, deprioritize. Bill-upload parsing accuracy is the single most important technical capability and should be treated as P0.
