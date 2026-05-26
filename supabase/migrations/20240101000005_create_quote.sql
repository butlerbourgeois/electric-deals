CREATE TABLE quote (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usage_profile_id          UUID NOT NULL REFERENCES usage_profile(id) ON DELETE CASCADE,
  plan_id                   UUID NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  estimated_monthly_bill    NUMERIC(8,2) NOT NULL,
  estimated_annual_cost     NUMERIC(10,2) NOT NULL,
  effective_rate_per_kwh    NUMERIC(6,4) NOT NULL,
  rank                      INTEGER NOT NULL,
  rank_reason               TEXT NOT NULL DEFAULT 'lowest annual cost',
  computed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX quote_profile_rank_idx ON quote (usage_profile_id, rank);
CREATE INDEX quote_plan_idx ON quote (plan_id);
