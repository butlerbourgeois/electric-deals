import { createClient } from '@/lib/supabase/server'
import { EnrollmentHandoff, EnrollmentHandoffInsert } from '@/types/database'

/**
 * Records an outbound enrollment click for affiliate attribution.
 * The sub_id is the external identifier sent to the aggregator network
 * for commission reconciliation.
 */
export async function recordHandoff(
  input: EnrollmentHandoffInsert
): Promise<EnrollmentHandoff> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('enrollment_handoff')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`recordHandoff failed: ${error.message}`)
  return data as EnrollmentHandoff
}
