import { createClient } from '@/lib/supabase/server'
import { createAdminClient, formatSupabaseError } from '@/lib/supabase/admin'
import { Quote, QuoteInsert, PlanWithProvider } from '@/types/database'

/**
 * Bulk-inserts a ranked list of quotes and returns the created rows with their IDs.
 * Uses the service-role client — quotes are created server-side, not by users directly.
 */
export async function insertQuotes(rows: QuoteInsert[]): Promise<Quote[]> {
  if (rows.length === 0) return []
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('quote')
    .insert(rows)
    .select()

  if (error) throw new Error(`insertQuotes failed: ${formatSupabaseError(error)}`)
  return (data ?? []) as Quote[]
}

/**
 * Returns a single quote joined with its plan and provider.
 */
export async function getQuoteWithPlan(
  quoteId: string
): Promise<(Quote & { plan: PlanWithProvider }) | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('quote')
    .select('*, plan:plan_id(*, provider:provider_id(*))')
    .eq('id', quoteId)
    .maybeSingle()

  if (error) throw new Error(`getQuoteWithPlan failed: ${error.message}`)
  return data as (Quote & { plan: PlanWithProvider }) | null
}
