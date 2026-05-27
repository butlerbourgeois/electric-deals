import { createClient } from '@/lib/supabase/server'
import { PlanWithProvider } from '@/types/database'

const MAX_PLANS_PER_QUERY = 200

/**
 * Returns all active plans for a given TDU territory, joined with provider.
 * Sorted by rate_1000_kwh ascending (cheapest headline rate first — re-ranked by calculator later).
 */
export async function getActivePlansForTdu(tdu: string): Promise<PlanWithProvider[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('plan')
    .select('*, provider:provider_id(*)')
    .eq('tdu_territory', tdu)
    .eq('is_active', true)
    .order('rate_1000_kwh', { ascending: true, nullsFirst: false })
    .limit(MAX_PLANS_PER_QUERY)

  if (error) throw new Error(`getActivePlansForTdu failed: ${error.message}`)
  return (data ?? []) as PlanWithProvider[]
}

/**
 * Returns a single plan with its provider, or null if not found.
 */
export async function getPlanById(id: string): Promise<PlanWithProvider | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('plan')
    .select('*, provider:provider_id(*)')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`getPlanById failed: ${error.message}`)
  return data as PlanWithProvider | null
}

/**
 * Returns a paginated list of all active plans (for sitemap generation).
 * Returns id and updated_at only to keep the payload small.
 */
export async function getAllActivePlanIds(
  page = 0,
  pageSize = 1000
): Promise<Array<{ id: string; updated_at: string }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('plan')
    .select('id, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (error) throw new Error(`getAllActivePlanIds failed: ${error.message}`)
  return data ?? []
}
