import { createAdminClient, formatSupabaseError } from '@/lib/supabase/admin'
import { EnrollmentHandoff, EnrollmentHandoffInsert } from '@/types/database'

/**
 * Records an outbound enrollment click for affiliate attribution.
 * The sub_id is the external identifier sent to the aggregator network
 * for commission reconciliation.
 * Uses the service-role client — handoffs are server-initiated writes.
 */
export async function recordHandoff(
  input: EnrollmentHandoffInsert
): Promise<EnrollmentHandoff> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('enrollment_handoff')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`recordHandoff failed: ${formatSupabaseError(error)}`)
  return data as EnrollmentHandoff
}
