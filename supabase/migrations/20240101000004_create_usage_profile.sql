CREATE TYPE home_type AS ENUM ('apartment', 'small_home', 'large_home');

CREATE TABLE usage_profile (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT,
  session_id      TEXT NOT NULL,
  zip             TEXT NOT NULL,
  tdu_territory   tdu_territory NOT NULL,
  monthly_kwh     INTEGER,
  monthly_bill    NUMERIC(8,2),
  home_type       home_type,
  preferences     JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX usage_profile_email_idx ON usage_profile (email) WHERE email IS NOT NULL;
CREATE INDEX usage_profile_session_idx ON usage_profile (session_id);
CREATE INDEX usage_profile_zip_idx ON usage_profile (zip);

CREATE TRIGGER usage_profile_updated_at
  BEFORE UPDATE ON usage_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
