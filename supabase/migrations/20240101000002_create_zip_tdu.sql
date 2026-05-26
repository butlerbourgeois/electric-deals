CREATE TYPE tdu_territory AS ENUM (
  'oncor',
  'centerpoint',
  'aep_central',
  'aep_north',
  'tnmp',
  'NON_DEREGULATED'
);

CREATE TABLE zip_tdu (
  zip           TEXT PRIMARY KEY,
  tdu_territory tdu_territory NOT NULL,
  city          TEXT NOT NULL DEFAULT '',
  county        TEXT NOT NULL DEFAULT ''
);

CREATE INDEX zip_tdu_territory_idx ON zip_tdu (tdu_territory);
