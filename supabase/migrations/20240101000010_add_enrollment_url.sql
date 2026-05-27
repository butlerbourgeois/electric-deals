-- Add enrollment_url to the plan table.
--
-- efl_url  = the regulatory Electricity Facts Label PDF — for disclosure only.
-- enrollment_url = the page where a customer actually signs up for the plan.
--
-- These are different URLs. The handoff route must use enrollment_url, not efl_url.
-- Before this column existed, the handoff incorrectly redirected users to a PDF.

ALTER TABLE plan ADD COLUMN IF NOT EXISTS enrollment_url TEXT;
