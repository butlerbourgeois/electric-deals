import { SupabaseClient } from '@supabase/supabase-js'
import { RenewalAlert, RenewalAlertWithPlan, EmailSendMilestone } from '@/types/database'
import { getResendClient } from './resend'
import { fromAddress, appBaseUrl } from './config'
import { welcomeEmailHtml, welcomeEmailText, welcomeEmailSubject } from './templates/welcome'
import { renewalReminderHtml, renewalReminderText, renewalReminderSubject } from './templates/renewal-reminder'
import { createEmailSendRecord, markEmailSent, markEmailFailed } from '@/lib/db/renewal-alerts'
import type { TduTerritory } from '@/types/database'

export interface SendResult {
  success: boolean
  resendMessageId?: string
  error?: string
}

// ─── TDU label helpers ────────────────────────────────────────────────────────

const TDU_LABELS: Record<TduTerritory, string> = {
  oncor:            'Oncor (Dallas/Fort Worth area)',
  centerpoint:      'CenterPoint (Houston area)',
  aep_central:      'AEP Central (Corpus Christi / San Angelo)',
  aep_north:        'AEP North (Abilene / Wichita Falls)',
  tnmp:             'TNMP (Lewisville / Galveston area)',
  NON_DEREGULATED:  'Non-deregulated area',
}

function tduLabel(tdu: TduTerritory): string {
  return TDU_LABELS[tdu] ?? tdu
}

// ─── URL builders ─────────────────────────────────────────────────────────────

function unsubscribeUrl(alert: RenewalAlert): string {
  return `${appBaseUrl}/unsubscribe/${alert.unsubscribe_token}`
}

function compareUrl(alert: RenewalAlert): string {
  return `${appBaseUrl}/api/compare/from-alert/${alert.id}`
}

// ─── Welcome email ────────────────────────────────────────────────────────────

/**
 * Sends the welcome email for a new renewal alert.
 *
 * Flow:
 *   1. Insert a 'pending' email_send row so we have a record even if sending fails.
 *   2. Attempt to send via Resend.
 *   3. On success: mark the row 'sent' with the Resend message ID.
 *   4. On failure: mark the row 'failed', log the error, return { success: false }.
 *
 * Does not throw — callers handle the returned SendResult.
 */
export async function sendWelcomeEmail(
  _supabase: SupabaseClient,
  alert: RenewalAlertWithPlan
): Promise<SendResult> {
  const milestone: EmailSendMilestone = 'welcome'

  // Step 1: create a pending record before we attempt the send
  try {
    await createEmailSendRecord({
      renewal_alert_id: alert.id,
      milestone,
      status: 'pending',
      sent_at: null,
      resend_message_id: null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[orchestrator] sendWelcomeEmail: failed to create email_send record for alert ${alert.id}: ${msg}`)
    return { success: false, error: `DB pre-insert failed: ${msg}` }
  }

  // Step 2: send via Resend
  const planName = alert.plan.name
  const providerName = alert.plan.provider.name
  const emailData = {
    planName,
    providerName,
    contractEndDate: formatContractEndDate(alert.contract_end_date),
    tduTerritory: tduLabel(alert.tdu_territory),
    monthlyKwh: alert.monthly_kwh,
    unsubscribeUrl: unsubscribeUrl(alert),
  }

  try {
    const resend = getResendClient()
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: alert.email,
      subject: welcomeEmailSubject(emailData),
      html: welcomeEmailHtml(emailData),
      text: welcomeEmailText(emailData),
    })

    if (error || !data?.id) {
      const msg = error?.message ?? 'Resend returned no message ID'
      console.error(`[orchestrator] sendWelcomeEmail: Resend error for alert ${alert.id}: ${msg}`)
      await markEmailFailed(alert.id, milestone, msg)
      return { success: false, error: msg }
    }

    // Step 3: mark sent
    await markEmailSent(alert.id, milestone, data.id)
    return { success: true, resendMessageId: data.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[orchestrator] sendWelcomeEmail: unexpected error for alert ${alert.id}: ${msg}`)
    // Best-effort — don't let a markEmailFailed failure swallow the original error
    await markEmailFailed(alert.id, milestone, msg).catch(() => undefined)
    return { success: false, error: msg }
  }
}

// ─── Renewal reminder ─────────────────────────────────────────────────────────

/**
 * Sends a d45/d30/d15 renewal reminder for an alert.
 *
 * Idempotent: if the email_send row for this (alert.id, milestone) already
 * exists with status !== 'pending', the send is skipped and success is returned.
 * This guards against double-sends if the cron runs overlap.
 *
 * Flow:
 *   1. Check for existing non-pending email_send row → skip if found.
 *   2. Upsert a 'pending' email_send row.
 *   3. Attempt to send via Resend.
 *   4. Update the row on success or failure.
 */
export async function sendRenewalReminder(
  supabase: SupabaseClient,
  alert: RenewalAlertWithPlan,
  milestone: EmailSendMilestone,
  cheaperPlan?: { name: string; providerName: string; estimatedMonthlySavings: number }
): Promise<SendResult> {
  // Step 1: idempotency check — skip if already sent or failed for this milestone
  const { data: existingRow, error: checkError } = await supabase
    .from('email_send')
    .select('status')
    .eq('renewal_alert_id', alert.id)
    .eq('milestone', milestone)
    .maybeSingle()

  if (checkError) {
    const msg = checkError.message
    console.error(`[orchestrator] sendRenewalReminder: idempotency check failed for alert ${alert.id} / ${milestone}: ${msg}`)
    return { success: false, error: `Idempotency check failed: ${msg}` }
  }

  if (existingRow && existingRow.status !== 'pending') {
    // Already processed — skip silently
    return { success: true }
  }

  // Step 2: upsert a pending row so we have a record even if sending fails
  try {
    await createEmailSendRecord({
      renewal_alert_id: alert.id,
      milestone,
      status: 'pending',
      sent_at: null,
      resend_message_id: null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[orchestrator] sendRenewalReminder: failed to create email_send record for alert ${alert.id}: ${msg}`)
    return { success: false, error: `DB pre-insert failed: ${msg}` }
  }

  // Map milestone to daysUntilExpiry for the template
  const daysUntilExpiry = milestoneTodays(milestone)

  const emailData = {
    planName: alert.plan.name,
    providerName: alert.plan.provider.name,
    daysUntilExpiry,
    contractEndDate: formatContractEndDate(alert.contract_end_date),
    monthlyKwh: alert.monthly_kwh,
    tduTerritory: tduLabel(alert.tdu_territory),
    compareUrl: compareUrl(alert),
    unsubscribeUrl: unsubscribeUrl(alert),
    cheaperPlan,
  }

  // Step 3: send via Resend
  try {
    const resend = getResendClient()
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: alert.email,
      subject: renewalReminderSubject(emailData),
      html: renewalReminderHtml(emailData),
      text: renewalReminderText(emailData),
    })

    if (error || !data?.id) {
      const msg = error?.message ?? 'Resend returned no message ID'
      console.error(`[orchestrator] sendRenewalReminder: Resend error for alert ${alert.id} / ${milestone}: ${msg}`)
      await markEmailFailed(alert.id, milestone, msg)
      return { success: false, error: msg }
    }

    // Step 4: mark sent
    await markEmailSent(alert.id, milestone, data.id)
    return { success: true, resendMessageId: data.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[orchestrator] sendRenewalReminder: unexpected error for alert ${alert.id} / ${milestone}: ${msg}`)
    await markEmailFailed(alert.id, milestone, msg).catch(() => undefined)
    return { success: false, error: msg }
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Map milestone enum to the canonical days-until-expiry value used in templates.
 * Falls back to a best guess for any unexpected value.
 */
function milestoneTodays(milestone: EmailSendMilestone): number {
  switch (milestone) {
    case 'd45': return 45
    case 'd30': return 30
    case 'd15': return 15
    default:    return 0
  }
}

/**
 * Format an ISO date string (YYYY-MM-DD) into a human-readable contract end date.
 * Example: "2027-03-01" → "March 2027" (day is dropped — contract months are what matter)
 * "2027-03-15" → "March 15, 2027" (day kept when it's not the 1st)
 */
function formatContractEndDate(isoDate: string): string {
  // Parse as UTC noon to avoid timezone-induced day-off-by-one errors
  const date = new Date(`${isoDate}T12:00:00Z`)
  const month = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const day   = date.getUTCDate()
  const year  = date.getUTCFullYear()

  // Show day only when it's not the first (which typically means "first of month")
  return day === 1
    ? `${month} ${year}`
    : `${month} ${day}, ${year}`
}
