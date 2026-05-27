-- Renewal alert + email send log tables.
--
-- renewal_alert: one row per (email, plan) enrollment we're tracking for renewal.
--   Captures the plan the user enrolled in, their usage, and when the contract ends.
--   Drives the 45/30/15-day email reminders.
--
-- email_send: idempotent log of every email sent. The unique index on
--   (renewal_alert_id, milestone) ensures each reminder fires at most once,
--   even if the cron fires multiple times (Vercel cron is at-least-once).

-- ── renewal_alert ──────────────────────────────────────────────────────────────

CREATE TABLE renewal_alert (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT        NOT NULL,
  plan_id              UUID        NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  usage_profile_id     UUID        REFERENCES usage_profile(id) ON DELETE SET NULL,
  tdu_territory        tdu_territory NOT NULL,
  monthly_kwh          NUMERIC     NOT NULL CHECK (monthly_kwh > 0),
  -- Contract timing: end_date is required; start derived from end - term_months
  contract_end_date    DATE        NOT NULL,
  term_months          INTEGER     NOT NULL CHECK (term_months >= 0),
  -- Unsubscribe token: random hex, used in one-click unsubscribe links
  unsubscribe_token    TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status               TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'unsubscribed', 'bounced', 'completed')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX renewal_alert_email_idx          ON renewal_alert (email);
CREATE INDEX renewal_alert_end_date_idx       ON renewal_alert (contract_end_date) WHERE status = 'active';
CREATE INDEX renewal_alert_unsubscribe_idx    ON renewal_alert (unsubscribe_token);

-- ── email_send ─────────────────────────────────────────────────────────────────

CREATE TABLE email_send (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_alert_id     UUID        NOT NULL REFERENCES renewal_alert(id) ON DELETE CASCADE,
  -- milestone: which email in the sequence
  milestone            TEXT        NOT NULL
                         CHECK (milestone IN ('welcome', 'd45', 'd30', 'd15')),
  sent_at              TIMESTAMPTZ,           -- null until actually sent
  resend_message_id    TEXT,                  -- Resend's message ID for event correlation
  status               TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'opened', 'clicked')),
  -- Idempotency: each (alert, milestone) pair fires at most once
  UNIQUE (renewal_alert_id, milestone)
);

CREATE INDEX email_send_resend_idx ON email_send (resend_message_id) WHERE resend_message_id IS NOT NULL;

-- ── grants ─────────────────────────────────────────────────────────────────────
-- Both tables are server-side only — anon/authenticated never touch them directly.
-- service_role handles all inserts/reads via the admin client in API routes + cron.

GRANT ALL ON renewal_alert TO service_role;
GRANT ALL ON email_send    TO service_role;
