-- Extend enrollment_handoff with email capture tracking.
--
-- email_captured: true when the user submitted their email before being redirected.
--   false (default) when they clicked the skip link or submitted before the modal appeared.
--
-- renewal_alert_id: FK to the renewal_alert row created at capture time.
--   null when no email was captured (skip path).
--   Allows joining handoff → renewal_alert → email_send for attribution reporting.

ALTER TABLE enrollment_handoff
  ADD COLUMN IF NOT EXISTS email_captured   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS renewal_alert_id UUID    REFERENCES renewal_alert(id) ON DELETE SET NULL;

CREATE INDEX enrollment_handoff_alert_idx
  ON enrollment_handoff (renewal_alert_id) WHERE renewal_alert_id IS NOT NULL;
