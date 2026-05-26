---
name: project-scaffold
description: Core architecture, toolchain, and directory layout for electric-deals
metadata:
  type: project
---

Texas electricity comparison SaaS. Next.js 16.2.6 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Supabase.

**Why:** User requested Next.js 14 but create-next-app@latest installed 16.2.6. Architecture is identical — App Router, same flags, same patterns. No regression risk.

**How to apply:** Treat this as a standard Next.js App Router project. All patterns (Server Components, route groups, `@/*` alias) work identically on 16.x.

## Key paths
- `/app/(marketing)/` — public-facing pages (route group, no URL segment)
- `/app/(app)/` — authenticated app pages (route group)
- `/components/ui/` — shadcn components
- `/lib/supabase/client.ts` — browser Supabase client (createBrowserClient)
- `/lib/supabase/server.ts` — server Supabase client (createServerClient, async, uses next/headers cookies)
- `/lib/calculator/` — pure cost calculation logic (no side effects)
- `/types/database.ts` — all shared domain types (Plan, Provider, ZipTdu, UsageProfile, Quote, EnrollmentHandoff)
- `/scripts/` — ingestion/ETL scripts
- `/supabase/migrations/` — DB migration SQL files
- `/supabase/seed/` — seed data

## Toolchain
- Node.js 24.12.0 (Windows, accessed via cmd.exe — `node` not in WSL PATH directly)
- npm 11.6.2
- gh CLI at `/mnt/c/Program Files/GitHub CLI/gh.exe`
- All npm/npx commands must be run via `cmd.exe /c "cd /d C:\\coding\\repos\\electric-deals && <command>"`

## Environment
- WSL2 on Windows; Node.js is Windows-native, not in WSL PATH
- To run node commands: `cmd.exe /c "cd /d C:\\coding\\repos\\electric-deals && npm ..."`
- Git works natively in WSL (git is installed in Linux layer)
- GitHub push requires token auth: get via `gh.exe auth token`, inject into remote URL, then clean it

## Supabase setup status
- supabase-js and @supabase/ssr installed
- supabase CLI installed as devDependency
- `supabase init` NOT run — user will create project in browser and fill in .env.local
- .env.local has placeholder values to prevent startup crash

## What's NOT done yet (manual steps for user)
1. Create Supabase project at supabase.com, copy URL + anon key + service role key into .env.local
2. Connect GitHub repo to Vercel at vercel.com/new (do NOT use Vercel CLI)
3. Add env vars to Vercel dashboard after connecting
