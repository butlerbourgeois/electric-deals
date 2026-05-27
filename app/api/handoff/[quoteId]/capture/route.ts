import { NextRequest, NextResponse } from 'next/server'
import { getQuoteWithPlan } from '@/lib/db/quotes'
import { createAdminClient } from '@/lib/supabase/admin'
import { RenewalAlertInsert, RenewalAlertWithPlan } from '@/types/database'
import { sendWelcomeEmail } from '@/lib/email/orchestrator'

/** Simple email format check — full RFC validation is overkill here. */
function isValidEmail(value: string): boolean {
  return value.length > 0 && value.includes('@') && value.includes('.')
}

/** Accepts YYYY-MM-DD; returns true only if it's a real date in the future. */
function isValidFutureDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value)
  if (isNaN(d.getTime())) return false
  return d > new Date()
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params

    // ── 1. Parse + validate request body ─────────────────────────────────────
    let body: { email?: unknown; contractEndDate?: unknown; termMonths?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { email, contractEndDate, termMonths } = body

    if (typeof email !== 'string' || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (typeof contractEndDate !== 'string' || !isValidFutureDate(contractEndDate)) {
      return NextResponse.json(
        { error: 'contractEndDate must be a valid YYYY-MM-DD date in the future' },
        { status: 400 }
      )
    }
    const parsedTermMonths =
      typeof termMonths === 'number' ? termMonths : Number(termMonths)
    if (!Number.isFinite(parsedTermMonths) || parsedTermMonths < 0) {
      return NextResponse.json({ error: 'termMonths must be a non-negative number' }, { status: 400 })
    }

    // ── 2. Load quote + plan ──────────────────────────────────────────────────
    const quoteWithPlan = await getQuoteWithPlan(quoteId)
    if (!quoteWithPlan) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }
    const { plan, usage_profile_id, plan_id } = quoteWithPlan

    // ── 3. Load usage profile for monthly_kwh ────────────────────────────────
    const supabase = createAdminClient()

    let monthlyKwh = 1000 // safe default
    if (usage_profile_id) {
      const { data: profile, error: profileError } = await supabase
        .from('usage_profile')
        .select('monthly_kwh')
        .eq('id', usage_profile_id)
        .single()

      if (profileError) {
        // Non-fatal — proceed with the default
        console.warn('[capture] Could not load usage_profile:', profileError.message)
      } else if (profile?.monthly_kwh != null) {
        monthlyKwh = profile.monthly_kwh
      }
    }

    // ── 4. Insert renewal_alert ───────────────────────────────────────────────
    const alertInsert: RenewalAlertInsert = {
      email,
      plan_id,
      usage_profile_id,
      tdu_territory: plan.tdu_territory,
      monthly_kwh: monthlyKwh,
      contract_end_date: contractEndDate,
      term_months: parsedTermMonths,
    }

    const { data, error: insertError } = await supabase
      .from('renewal_alert')
      .insert(alertInsert)
      .select('id')
      .single()

    if (insertError || !data) {
      console.error('[capture] Failed to insert renewal_alert:', insertError)
      return NextResponse.json(
        { error: 'Failed to save renewal alert' },
        { status: 500 }
      )
    }

    // ── 5. Fire welcome email async — don't block the response ──────────────
    // The renewal_alert row is already committed; if this fails, the alert still
    // exists and the cron job will send future milestone reminders. We construct
    // a RenewalAlertWithPlan inline from the data we already have to avoid a
    // round-trip DB read just for the email send.
    const alertRow: RenewalAlertWithPlan = {
      id: data.id,
      email,
      plan_id,
      usage_profile_id,
      tdu_territory: plan.tdu_territory,
      monthly_kwh: monthlyKwh,
      contract_end_date: contractEndDate,
      term_months: parsedTermMonths,
      // unsubscribe_token and status are set by the DB; placeholders are safe
      // here because sendWelcomeEmail only reads id, email, plan, and contract fields.
      unsubscribe_token: '',
      status: 'active',
      created_at: new Date().toISOString(),
      plan: {
        ...plan,
        provider: plan.provider ?? { id: '', name: '', puct_number: null, logo_url: null, website: null, created_at: '', updated_at: '' },
      },
    }

    sendWelcomeEmail(supabase, alertRow).catch((err: unknown) =>
      console.error('[capture] Welcome email failed:', err)
    )

    return NextResponse.json({ renewalAlertId: data.id })
  } catch (err) {
    console.error('[/api/handoff/capture] Unexpected error:', err)
    return NextResponse.json({ error: 'Failed to save renewal alert' }, { status: 500 })
  }
}
