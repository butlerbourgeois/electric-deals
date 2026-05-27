-- Add gotcha warnings and pre-computed projected costs to the plan table.
--
-- gotchas: JSONB array of Gotcha objects derived at ingest time from the plan's
--   component rates. Each object has: code, severity, title, detail, and optional
--   threshold_kwh / swing_dollars for numeric gotchas.
--   Storing this on plan (not quote) because gotchas are properties of the plan
--   itself — the same cliff exists regardless of who is comparing.
--
-- projected_costs: JSONB object pre-computing estimated monthly/annual costs at
--   the three standard Texas EFL anchor points (500 / 1000 / 2000 kWh).
--   Avoids re-running the calculator on every compare request.

ALTER TABLE plan
  ADD COLUMN IF NOT EXISTS gotchas         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS projected_costs JSONB;

-- Partial index: quickly find plans with at least one gotcha (future filter toggle)
CREATE INDEX IF NOT EXISTS plan_has_gotchas_idx
  ON plan ((jsonb_array_length(gotchas) > 0));
