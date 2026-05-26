CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE provider (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  puct_number     TEXT,
  logo_url        TEXT,
  website         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX provider_name_idx ON provider (name);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER provider_updated_at
  BEFORE UPDATE ON provider
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
