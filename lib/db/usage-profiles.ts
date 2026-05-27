import { createClient } from '@/lib/supabase/server'
import { UsageProfile, UsageProfileInsert } from '@/types/database'

/**
 * Inserts a new usage profile and returns the created row.
 */
export async function createUsageProfile(
  input: UsageProfileInsert
): Promise<UsageProfile> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usage_profile')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createUsageProfile failed: ${error.message}`)
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
