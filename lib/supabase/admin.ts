import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for server-side API routes.
 *
 * Bypasses RLS entirely — use only in server-side code (Route Handlers,
 * server actions, scripts). Never expose the service role key to the browser.
 *
 * Rule of thumb:
 *   - Server Components doing user-scoped reads  → lib/supabase/server.ts (anon key + RLS)
 *   - API Route Handlers doing server-side writes → this file (service role)
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || url === 'your-project-url' || !url.includes('.supabase.co')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not configured. ' +
      'Set it in .env.local to your Supabase project URL (https://xxxx.supabase.co).'
    )
  }
  if (!key || key === 'your-service-role-key') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
      'Set it in .env.local (find it in Supabase Dashboard → Settings → API).'
    )
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/** Formats a Supabase error into a readable string including code + details. */
export function formatSupabaseError(error: {
  message?: string
  code?: string
  details?: string
  hint?: string
}): string {
  const parts = [
    error.message && `message: ${error.message}`,
    error.code    && `code: ${error.code}`,
    error.details && `details: ${error.details}`,
    error.hint    && `hint: ${error.hint}`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' | ') : 'unknown Supabase error (check server logs)'
}
