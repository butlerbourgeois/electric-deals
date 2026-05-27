---
name: project-comparepower-api
description: ComparePower live API endpoint discovery, data shape, and field mapping
metadata:
  type: project
---

The live ComparePower plan data API is at `pricing.api.comparepower.com`, NOT `api.comparepower.com` (that domain is dead/404).

**Why:** `api.comparepower.com` was documented in older references but the company rebuilt their product as a Nuxt SPA at `plans.comparepower.com`. The real API URLs are injected via `window.__NUXT__.config` in the SPA HTML. Found via: `curl https://plans.comparepower.com/ | grep __NUXT__`.

**How to apply:** Any future ingestion or cron work must use `pricing.api.comparepower.com`. The SPA also references `ercot.api.comparepower.com` for utility metadata.

## Working endpoint

```
GET https://pricing.api.comparepower.com/api/plans?tdsp_duns=<DUNS>&current=true
Headers: Origin: https://plans.comparepower.com
         Referer: https://plans.comparepower.com/
```

Returns an array of plan objects. All 5 TDU DUNS numbers work. Counts as of 2026-05-27:
- oncor       (1039940674000): ~143 plans
- centerpoint (957877905):     ~142 plans
- aep_central (007924772):     ~141 plans
- aep_north   (007923311):     ~140 plans
- tnmp        (007929441):     ~140 plans

Total: ~706 plans, ~18 unique REPs.

## Data shape (key fields)

```
plan._id                         → external_id (MongoDB ObjectId string)
plan.product.brand.name          → provider name
plan.product.name                → plan name
plan.product.display_name        → preferred display name (falls back to name)
plan.product.term                → term_months (1 = variable/month-to-month)
plan.product.percent_green       → renewable_percent (0-100 integer)
plan.product.early_termination_fee → cancellation_fee (number)
plan.product.is_time_of_use      → true = TOU plan
plan.expected_prices             → [{usage: 500|1000|2000, price: $/kWh}]
plan.components                  → charge breakdown (see below)
plan.document_links              → [{type: 'efl'|'tos'|'yraac', link: url}]
```

## Component breakdown logic

Components encode the full pricing model as a list:
- `tdsp_charge=true, !multiplicative`  → TDU flat monthly charge ($/mo)
- `tdsp_charge=true, multiplicative`   → TDU per-kWh passthrough ($/kWh)
- `!tdsp_charge, !multiplicative, >0`  → REP base charge ($/mo)
- `!tdsp_charge, multiplicative, >0`   → REP energy charge ($/kWh)
- `amount < 0, !multiplicative`        → bill credit; `min` = usage threshold kWh

## Plan type inference

ComparePower has no explicit `plan_type` field. Infer:
- `is_time_of_use=true` → 'tou'
- `term <= 1`           → 'variable'
- 'index'/'real-time' in name/family → 'indexed'
- otherwise             → 'fixed'

## Supabase placeholder detection note

The .env.local URL was set to `https://supabase.com/dashboard/project/<id>` (the
dashboard URL), not the API URL `https://<id>.supabase.co`. The old placeholder
check (`includes('your-project')`) didn't catch it. The fixed check requires
`.supabase.co` in the URL or absence of `supabase.com/dashboard`.
