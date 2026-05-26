# Database Setup

## First-time setup

1. Create a Supabase project at https://supabase.com/dashboard
2. Copy your Project URL, anon key, and service role key into `.env.local`
3. Install Supabase CLI: `npm install -D supabase` (already done)
4. Link to your project: `npx supabase link --project-ref YOUR_PROJECT_REF`
   (Find project ref in Supabase dashboard URL: supabase.com/dashboard/project/YOUR_REF)
5. Run migrations: `npx supabase db push`
6. Load seed data: `npx supabase db reset` (runs migrations + seed) OR manually paste seed SQL in the Supabase SQL Editor

## Verifying the schema

After running migrations, in the Supabase Table Editor you should see:
- `provider` — empty
- `plan` — empty (populated by `npm run ingest`)
- `zip_tdu` — ~45 rows (after seed)
- `usage_profile` — empty
- `quote` — empty
- `enrollment_handoff` — empty

## Quick test queries (run in Supabase SQL Editor)

```sql
-- Should return 'centerpoint'
SELECT tdu_territory FROM zip_tdu WHERE zip = '77002';

-- Should return 'oncor'
SELECT tdu_territory FROM zip_tdu WHERE zip = '75201';

-- Should return 'NON_DEREGULATED'
SELECT tdu_territory FROM zip_tdu WHERE zip = '78701';
```
