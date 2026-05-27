import { createClient } from '@/lib/supabase/server'
import { createAdminClient, formatSupabaseError } from '@/lib/supabase/admin'
import { UsageProfile, UsageProfileInsert } from '@/types/database'

/**
 * Inserts a new usage profile and returns the created row.
 * Uses the service-role client so RLS and missing grants never block
 * server-side writes from Route Handlers.
 */
export async function createUsageProfile(
  input: UsageProfileInsert
): Promise<UsageProfile> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('usage_profile')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createUsageProfile failed: ${formatSupabaseError(error)}`)
  return data as UsageProfile
}

/**
 * Returns a usage profile by ID, or null if not found.
 */
export async function getUsageProfile(id: string): Promise<UsageProfile | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usage_profile')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getUsageProfile failed: ${error.message}`)
  return data as UsageProfile | null
}
