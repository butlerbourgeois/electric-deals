import { createAdminClient, formatSupabaseError } from '@/lib/supabase/admin'
import {
  RenewalAlert,
  RenewalAlertInsert,
  RenewalAlertWithPlan,
  EmailSendInsert,
  EmailSendMilestone,
} from '@/types/database'

// ─── Milestone window constants (days before contract end) ────────────────────
// We use a ±2-day buffer around each target so the cron job doesn't need to run
// at an exact moment. Rows that already have a sent/failed record are filtered
// by getAlertsDueForMilestone, making repeated runs idempotent.

const MILESTONE_WINDOWS: Record<EmailSendMilestone, { min: number; max: number }> = {
  welcome: { min: 0, max: 0 },  // not used by getAlertsDueForMilestone
  d45:     { min: 43, max: 47 },
  d30:     { min: 28, max: 32 },
  d15:     { min: 13, max: 17 },
}

// ─── RenewalAlert helpers ─────────────────────────────────────────────────────

/**
 * Insert a new renewal_alert row.
 * Returns the created row including the DB-generated unsubscribe_token.
 */
export async function createRenewalAlert(data: RenewalAlertInsert): Promise<RenewalAlert> {
  const supabase = createAdminClient()

  const { data: row, error } = await supabase
    .from('renewal_alert')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`createRenewalAlert failed: ${formatSupabaseError(error)}`)
  return row as RenewalAlert
}

/**
 * Look up a renewal_alert by its unsubscribe_token.
 * Used by the /unsubscribe page to validate and display the alert before confirming.
 */
export async function getRenewalAlertByToken(token: string): Promise<RenewalAlert | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('renewal_alert')
    .select()
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (error) throw new Error(`getRenewalAlertByToken failed: ${formatSupabaseError(error)}`)
  return data as RenewalAlert | null
}

/**
 * Get a renewal_alert by ID, joined with plan + provider.
 * Used by the orchestrator and the compare-from-alert route.
 */
export async function getRenewalAlertById(id: string): Promise<RenewalAlertWithPlan | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('renewal_alert')
    .select('*, plan:plan_id(*, provider:provider_id(*))')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getRenewalAlertById failed: ${formatSupabaseError(error)}`)
  return data as RenewalAlertWithPlan | null
}

/**
 * Mark a renewal_alert as unsubscribed.
 * Subsequent cron passes will skip active status checks and skip sending.
 */
export async function unsubscribeAlert(id: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('renewal_alert')
    .update({ status: 'unsubscribed' })
    .eq('id', id)

  if (error) throw new Error(`unsubscribeAlert failed: ${formatSupabaseError(error)}`)
}

/**
 * Returns all active renewal_alerts where the contract_end_date falls within
 * the fire window for the given milestone, AND that milestone has not yet been
 * sent (no email_send row with status 'sent' or 'failed').
 *
 * The ±2-day window means the cron job can run once per day without needing
 * sub-day precision.
 *
 * Excludes alerts with status 'unsubscribed', 'bounced', or 'completed'.
 */
export async function getAlertsDueForMilestone(
  milestone: 'd45' | 'd30' | 'd15'
): Promise<RenewalAlertWithPlan[]> {
  const supabase = createAdminClient()
  const window = MILESTONE_WINDOWS[milestone]

  // Calculate the date range: contract must end between today+min and today+max
  const today = new Date()
  const minDate = new Date(today)
  minDate.setDate(today.getDate() + window.min)
  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + window.max)

  const minIso = minDate.toISOString().slice(0, 10)
  const maxIso = maxDate.toISOString().slice(0, 10)

  // Fetch active alerts in the window, joined with plan + provider
  const { data: alerts, error: alertsError } = await supabase
    .from('renewal_alert')
    .select('*, plan:plan_id(*, provider:provider_id(*))')
    .eq('status', 'active')
    .gte('contract_end_date', minIso)
    .lte('contract_end_date', maxIso)

  if (alertsError) {
    throw new Error(`getAlertsDueForMilestone failed fetching alerts: ${formatSupabaseError(alertsError)}`)
  }

  if (!alerts || alerts.length === 0) return []

  const alertIds = alerts.map((a: RenewalAlert) => a.id)

  // Find which alerts already have a non-pending email_send for this milestone.
  // Pending rows are retryable (e.g. prior send attempt failed before marking).
  const { data: sentRows, error: sentError } = await supabase
    .from('email_send')
    .select('renewal_alert_id')
    .eq('milestone', milestone)
    .in('status', ['sent', 'failed'])
    .in('renewal_alert_id', alertIds)

  if (sentError) {
    throw new Error(`getAlertsDueForMilestone failed fetching sent rows: ${formatSupabaseError(sentError)}`)
  }

  const alreadySentIds = new Set((sentRows ?? []).map((r: { renewal_alert_id: string }) => r.renewal_alert_id))

  return (alerts as RenewalAlertWithPlan[]).filter(
    (alert) => !alreadySentIds.has(alert.id)
  )
}

// ─── EmailSend helpers ────────────────────────────────────────────────────────

/**
 * Create a pending email_send row before attempting to send.
 * Idempotent: if a row for (renewal_alert_id, milestone) already exists, does nothing.
 * This ensures a DB record always exists even if Resend fails.
 */
export async function createEmailSendRecord(data: EmailSendInsert): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('email_send')
    .upsert(data, { onConflict: 'renewal_alert_id,milestone', ignoreDuplicates: true })

  if (error) throw new Error(`createEmailSendRecord failed: ${formatSupabaseError(error)}`)
}

/**
 * Update an email_send row to 'sent' after a successful Resend delivery.
 */
export async function markEmailSent(
  renewalAlertId: string,
  milestone: string,
  resendMessageId: string
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('email_send')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      resend_message_id: resendMessageId,
    })
    .eq('renewal_alert_id', renewalAlertId)
    .eq('milestone', milestone)

  if (error) throw new Error(`markEmailSent failed: ${formatSupabaseError(error)}`)
}

/**
 * Update an email_send row to 'failed' after a Resend error.
 * The error message is logged in the DB for ops visibility.
 */
export async function markEmailFailed(
  renewalAlertId: string,
  milestone: string,
  errorMessage: string
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('email_send')
    .update({ status: 'failed' })
    .eq('renewal_alert_id', renewalAlertId)
    .eq('milestone', milestone)

  // Log but don't re-throw — we're already in a failure path
  if (error) {
    console.error(
      `markEmailFailed: could not update email_send row for alert ${renewalAlertId} / ${milestone}: ${formatSupabaseError(error)}. Original error: ${errorMessage}`
    )
  }
}
