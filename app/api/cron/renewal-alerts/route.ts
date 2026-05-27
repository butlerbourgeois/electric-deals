import { NextRequest, NextResponse } from 'next/server'
import { getAlertsDueForMilestone } from '@/lib/db/renewal-alerts'
import { sendRenewalReminder } from '@/lib/email/orchestrator'
import { calculateMonthlyCost } from '@/lib/calculator'
import { findCheaperPlan } from '@/lib/calculator/cheaper-than-current'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EmailSendMilestone } from '@/types/database'

// Vercel Cron invokes this as a GET request on the configured schedule.
// The CRON_SECRET guard prevents public callers from triggering email sends.
//
// To trigger manually for testing:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/renewal-alerts

const MILESTONES: Array<'d45' | 'd30' | 'd15'> = ['d45', 'd30', 'd15']

interface MilestoneResult {
  milestone: string
  processed: number
  sent: number
  failed: number
}

export async function GET(req: NextRequest) {
  // ── Auth: only Vercel Cron (or a bearer-token caller) may invoke this ──────
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const milestoneResults: MilestoneResult[] = []
  let totalProcessed = 0
  let totalSent = 0
  let totalFailed = 0

  for (const milestone of MILESTONES) {
    let processed = 0
    let sent = 0
    let failed = 0

    // Fetch alerts that are due for this milestone and haven't been sent yet
    let alerts
    try {
      alerts = await getAlertsDueForMilestone(milestone)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron/renewal-alerts] Failed to fetch alerts for milestone ${milestone}:`, msg)
      milestoneResults.push({ milestone, processed, sent, failed })
      continue
    }

    console.log(`[cron/renewal-alerts] ${milestone}: ${alerts.length} alert(s) due`)

    // Process sequentially to stay within Resend free-tier rate limits
    for (const alert of alerts) {
      processed++

      // Compute the current plan's monthly bill so we can compare alternatives
      const currentBill = calculateMonthlyCost(alert.plan, alert.monthly_kwh).estimatedMonthlyBill

      // Look for a cheaper plan in the same territory — null if none found
      let cheaperPlan: { name: string; providerName: string; estimatedMonthlySavings: number } | undefined

      try {
        const result = await findCheaperPlan(
          alert.tdu_territory,
          alert.monthly_kwh,
          alert.plan_id,
          currentBill
        )
        if (result) {
          cheaperPlan = {
            name: result.planName,
            providerName: result.providerName,
            estimatedMonthlySavings: result.estimatedMonthlySavings,
          }
        }
      } catch (err) {
        // Non-fatal: send the reminder without a savings callout rather than skip it
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(
          `[cron/renewal-alerts] findCheaperPlan failed for alert ${alert.id} (${milestone}): ${msg} — sending without savings callout`
        )
      }

      // Send the reminder
      const result = await sendRenewalReminder(
        supabase,
        alert,
        milestone as EmailSendMilestone,
        cheaperPlan
      )

      if (result.success) {
        sent++
        console.log(
          `[cron/renewal-alerts] Sent ${milestone} to alert ${alert.id}` +
          (result.resendMessageId ? ` (resend: ${result.resendMessageId})` : ' (skipped: already sent)')
        )
      } else {
        failed++
        console.error(
          `[cron/renewal-alerts] Failed ${milestone} for alert ${alert.id}: ${result.error}`
        )
      }
    }

    milestoneResults.push({ milestone, processed, sent, failed })
    totalProcessed += processed
    totalSent += sent
    totalFailed += failed
  }

  const summary = {
    total: { processed: totalProcessed, sent: totalSent, failed: totalFailed },
    milestones: milestoneResults,
  }

  console.log('[cron/renewal-alerts] Run complete:', JSON.stringify(summary))

  return NextResponse.json(summary)
}
