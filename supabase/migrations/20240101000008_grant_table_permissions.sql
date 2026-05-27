-- Grant table-level permissions to anon and authenticated roles.
--
-- When tables are created via raw SQL migrations (not Supabase Studio UI),
-- Supabase does NOT auto-grant SELECT/INSERT/UPDATE/DELETE.
-- Without these grants, RLS policies alone are insufficient — Postgres denies
-- the operation before even evaluating the RLS policy, producing an empty
-- error.message in the Supabase JS client.
--
-- Rule:
--   anon        → read-only on public catalog; insert on profile/quote/handoff
--   authenticated → same as anon for now (no auth in MVP)
--   service_role  → bypasses RLS entirely (used by our API routes via admin client)

-- Plan catalog: read-only for public
GRANT SELECT ON provider             TO anon, authenticated;
GRANT SELECT ON plan                 TO anon, authenticated;
GRANT SELECT ON zip_tdu              TO anon, authenticated;

-- User data: anon can insert (anonymous sessions), read own rows via RLS
GRANT SELECT, INSERT, UPDATE ON usage_profile      TO anon, authenticated;
GRANT SELECT, INSERT          ON quote             TO anon, authenticated;
GRANT SELECT, INSERT          ON enrollment_handoff TO anon, authenticated;
