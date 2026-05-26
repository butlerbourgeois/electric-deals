CREATE TYPE plan_type AS ENUM ('fixed', 'variable', 'indexed', 'tou');

CREATE TABLE plan (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id               UUID NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  external_id               TEXT,
  source                    TEXT NOT NULL DEFAULT 'powertochoose',
  name                      TEXT NOT NULL,
  plan_type                 plan_type NOT NULL DEFAULT 'fixed',
  term_months               INTEGER NOT NULL DEFAULT 12,
  tdu_territory             tdu_territory NOT NULL,
  rate_500_kwh              NUMERIC(6,4),
  rate_1000_kwh             NUMERIC(6,4),
  rate_2000_kwh             NUMERIC(6,4),
  base_monthly_charge       NUMERIC(8,2) NOT NULL DEFAULT 0,
  energy_charge_per_kwh     NUMERIC(6,4),
  tdu_charges_per_kwh       NUMERIC(6,4),
  tdu_monthly_charge        NUMERIC(8,2),
  bill_credit_amount        NUMERIC(8,2),
  bill_credit_threshold     INTEGER,
  renewable_percent         INTEGER NOT NULL DEFAULT 0 CHECK (renewable_percent BETWEEN 0 AND 100),
  cancellation_fee          NUMERIC(8,2) NOT NULL DEFAULT 0,
  efl_url                   TEXT,
  tos_url                   TEXT,
  yrac_url                  TEXT,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX plan_tdu_active_idx ON plan (tdu_territory, is_active);
CREATE INDEX plan_provider_idx ON plan (provider_id);
CREATE UNIQUE INDEX plan_external_source_idx ON plan (external_id, source) WHERE external_id IS NOT NULL;

CREATE TRIGGER plan_updated_at
  BEFORE UPDATE ON plan
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
