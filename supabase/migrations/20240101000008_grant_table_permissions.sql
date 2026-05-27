-- Grant table-level permissions to all Supabase roles.
--
-- When tables are created via raw SQL migrations (not Supabase Studio UI),
-- Supabase does NOT auto-grant SELECT/INSERT/UPDATE/DELETE to any role.
-- Without these grants, Postgres denies the operation before RLS is even
-- evaluated — producing an empty or "permission denied" error.
--
-- Roles:
--   anon          → unauthenticated browser/public requests
--   authenticated → logged-in users (future auth)
--   service_role  → server-side admin client (API routes, ingestion scripts)
--                   bypasses RLS but still needs table-level GRANT

-- ── service_role: full access on all tables (used by ingestion + API writes) ──
GRANT ALL ON provider              TO service_role;
GRANT ALL ON plan                  TO service_role;
GRANT ALL ON zip_tdu               TO service_role;
GRANT ALL ON usage_profile         TO service_role;
GRANT ALL ON quote                 TO service_role;
GRANT ALL ON enrollment_handoff    TO service_role;

-- ── anon / authenticated: scoped access enforced by RLS policies ──
-- Plan catalog: read-only
GRANT SELECT ON provider           TO anon, authenticated;
GRANT SELECT ON plan               TO anon, authenticated;
GRANT SELECT ON zip_tdu            TO anon, authenticated;

-- User data: insert allowed (anonymous sessions); reads restricted by RLS
GRANT SELECT, INSERT, UPDATE ON usage_profile      TO anon, authenticated;
GRANT SELECT, INSERT          ON quote             TO anon, authenticated;
GRANT SELECT, INSERT          ON enrollment_handoff TO anon, authenticated;
