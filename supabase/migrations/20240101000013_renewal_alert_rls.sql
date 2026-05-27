-- RLS for renewal_alert and email_send.
--
-- These tables contain email addresses (PII) and send logs.
-- Anon/authenticated users must not be able to read or write them directly.
-- All access goes through the service_role admin client (API routes, cron).
--
-- Enable RLS (blocks all access by default), then grant no policies for
-- anon/authenticated — service_role bypasses RLS entirely, so no policy needed there.

ALTER TABLE renewal_alert ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send    ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated — service_role bypasses RLS.
-- Any future user-facing reads (e.g. "manage my alerts" page) should add
-- a policy here that scopes to a verified email claim, not open reads.
