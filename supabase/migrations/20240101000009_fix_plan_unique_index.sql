-- Fix: replace the partial unique index on plan(external_id, source) with a
-- full unique index so ON CONFLICT (external_id, source) works in upserts.
--
-- The original migration used:
--   CREATE UNIQUE INDEX ... WHERE external_id IS NOT NULL
-- PostgreSQL's ON CONFLICT clause cannot target partial indexes, causing
-- "there is no unique or exclusion constraint matching the ON CONFLICT spec".

DROP INDEX IF EXISTS plan_external_source_idx;

CREATE UNIQUE INDEX plan_external_source_idx
  ON plan (external_id, source);
