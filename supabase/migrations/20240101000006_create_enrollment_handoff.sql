CREATE TYPE reconciled_status AS ENUM ('enrolled', 'rejected', 'pending');

CREATE TABLE enrollment_handoff (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id              UUID NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
  usage_profile_id      UUID NOT NULL REFERENCES usage_profile(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  aggregator            TEXT NOT NULL,
  handoff_url           TEXT NOT NULL,
  sub_id                TEXT NOT NULL,
  clicked_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciled_status     reconciled_status,
  commission_amount     NUMERIC(8,2),
  reconciled_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX enrollment_sub_id_idx ON enrollment_handoff (sub_id);
CREATE INDEX enrollment_clicked_at_idx ON enrollment_handoff (clicked_at);
CREATE INDEX enrollment_plan_idx ON enrollment_handoff (plan_id);
