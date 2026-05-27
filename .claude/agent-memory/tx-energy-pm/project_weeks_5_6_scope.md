---
name: project-weeks-5-6-scope
description: Weeks 5-6 sprint scope (locked 2026-05-27) — renewal alert capture + email pipeline via Resend
metadata:
  type: project
---

Locked Weeks 5-6 scope (2026-05-27): build the renewal-alert capture flow at handoff plus the email pipeline that sends welcome + 45/30/15-day reminder emails. Stack: Resend.com for transport, Vercel Cron for scheduling, new `renewal_alert` + `email_send` tables with idempotent (alert, milestone) unique index.

**Why:** This is the moat investment from [[project-differentiation-roadmap]]. ComparePower structurally cannot do renewal alerts because they don't capture email pre-handoff. Email capture turns one-shot affiliate clicks into a recurring relationship and unlocks the "never overpay again" positioning from [[project-competitive-positioning]].

**How to apply:** Capture is soft-gated (skip button always present — affiliate click is sacred); welcome email fires on capture; cron sends d45/d30/d15 milestones. Auth via Bearer CRON_SECRET. Hard bounces auto-mark `renewal_alert.status='bounced'` so cron skips them. No d0 email this sprint (needs back-off rule for re-quoted users). Phase A→B is critical path; C/D parallelize.

Key files added/modified:
- migrations 12-14: `renewal_alert`, `email_send`, `enrollment_handoff` email_captured/renewal_alert_id columns
- `lib/email/{resend,config,orchestrator}.ts` + `lib/email/templates/*`
- `lib/db/renewal-alerts.ts`, `lib/calculator/{contract-dates,cheaper-than-current}.ts`
- `app/api/handoff/[quoteId]/capture/route.ts` (new), patched `app/api/handoff/[quoteId]/route.ts` to accept `?ra=`
- `app/api/cron/renewal-alerts/route.ts` + `vercel.json` cron config
- `app/api/unsubscribe/route.ts` + `app/unsubscribe/[token]/page.tsx`
- `app/api/webhooks/resend/route.ts`
- `components/handoff/HandoffModal.tsx`, `RenewalAlertCopy.tsx`
- `app/api/compare/from-alert/[alertId]/route.ts` (email-link landing prefill)

Open risks to track: CAN-SPAM (not TCPA) governs these emails — lawyer review per [[project-compliance]] before production volume. Vercel Hobby plan caps at 2 daily crons.
