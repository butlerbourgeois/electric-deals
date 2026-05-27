---
name: project-renewal-alerts
description: Renewal alert sprint (Weeks 5-6) — what's been built, what's pending, key design decisions
metadata:
  type: project
---

Phase C (T6/T7/T8) complete. Phase D (T9/T10 + welcome email wire-up) complete. Phase D T11/T12/T13 complete as of 2026-05-27.

**What was built:**
- `components/handoff/HandoffModal.tsx` — `'use client'` modal that intercepts "View Plan & Enroll". Captures email + contract end date (month/year selects, pre-filled from termMonths). Submits to capture API, then redirects to `/api/handoff/[quoteId]?ra=[alertId]`. Failure/skip both redirect unconditionally — capture never blocks enrollment.
- `app/api/handoff/[quoteId]/capture/route.ts` — POST endpoint. Validates email, contractEndDate, termMonths. Loads quote+plan, usage_profile for monthly_kwh (defaults to 1000). Inserts `renewal_alert` row and fires welcome email async.
- `app/api/handoff/[quoteId]/route.ts` — patched to accept `?ra=` query param. Links `enrollment_handoff` to renewal_alert. Fully optional — failure is console.warn'd.
- `app/compare/page.tsx` — swapped enroll `<a>` for `<button>`, added HandoffModal.

**Phase D complete (cron + emails):**
- `lib/calculator/cheaper-than-current.ts` — `findCheaperPlan(tdu, kwh, currentPlanId, currentBill)`.
- `app/api/cron/renewal-alerts/route.ts` — GET handler, CRON_SECRET auth, runs d45/d30/d15.
- `vercel.json` — cron at `0 14 * * *` (9am CST).
- `.env.local.example` — CRON_SECRET + RESEND_WEBHOOK_SECRET entries.

**Phase D T11/T12/T13 complete (unsubscribe + webhook + from-alert):**
- `app/api/unsubscribe/route.ts` — GET handler. Validates token, calls `getRenewalAlertByToken` + `unsubscribeAlert`. Idempotent (already-unsubscribed → success). Redirects to `/unsubscribe/success` or `/unsubscribe/error`.
- `app/unsubscribe/success/page.tsx` — centered card with green checkmark, "Find a new plan" CTA.
- `app/unsubscribe/error/page.tsx` — centered card with red X, "Contact us" + "Compare plans" CTAs.
- `app/api/webhooks/resend/route.ts` — POST handler. RESEND_WEBHOOK_SECRET shared-secret guard (dev-permissive). Handles email.bounced/complained → marks email_send + renewal_alert as 'bounced'. Handles email.opened/clicked for analytics. Returns 500 on DB failure so Resend retries.
- `app/api/compare/from-alert/[alertId]/route.ts` — GET handler. Looks up alert, redirects to `/compare?tdu=&kwh=&from_alert=` for future pre-fill. Falls back to `/compare` on error.

**Key decisions:**
- contractEndDate stored as first of month (YYYY-MM-01) since users only pick month+year.
- Modal backdrop click = close = skip (no capture).
- Resend webhook uses shared-secret (dev-permissive) not svix HMAC for MVP. TODO: add full svix verify with `svix` npm package.
- `from_alert` query param preserved on compare redirect for future analytics attribution.
- already-unsubscribed/bounced alerts → redirect to /unsubscribe/success (idempotent UX).

**Why:** Legal/retention feature — remind users before contract expiry to prevent rolling onto variable rates.

**How to apply:** All Phase D pieces are wired. Next work: /compare pre-fill (tdu/kwh URL params) and full svix webhook verification.
