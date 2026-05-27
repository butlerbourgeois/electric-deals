import { NextRequest, NextResponse } from 'next/server'
import { getActivePlansForTdu } from '@/lib/db/plans'
import { createUsageProfile } from '@/lib/db/usage-profiles'
import { insertQuotes } from '@/lib/db/quotes'
import { getOrCreateSessionId } from '@/lib/session'
import { calculateMonthlyCost } from '@/lib/calculator'
import { rankReason } from '@/lib/calculator/rank-reason'
import { extractUsageSpecificGotchas, PlanForGotchas } from '@/lib/calculator/gotchas'
import { TduTerritory, QuoteInsert } from '@/types/database'

const MAX_RESULTS = 25

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { zip, tdu, monthlyKwh, monthlyBill, homeType, usageMethod } = body

    // Validate
    if (!zip || !tdu || (!monthlyKwh && !monthlyBill)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const kwh = Number(monthlyKwh)
    if (kwh < 1 || kwh > 10000) {
      return NextResponse.json({ error: 'Invalid kWh value' }, { status: 400 })
    }

    // Session
    const sessionId = await getOrCreateSessionId()

    // Persist usage profile
    const profile = await createUsageProfile({
      session_id: sessionId,
      email: null,
      zip,
      tdu_territory: tdu as TduTerritory,
      monthly_kwh: kwh,
      monthly_bill: monthlyBill ? Number(monthlyBill) : null,
      home_type: homeType ?? null,
      preferences: {},
    })

    // Fetch plans from DB
    const plans = await getActivePlansForTdu(tdu)

    if (plans.length === 0) {
      // Return empty results — don't error, the UI handles this gracefully
      return NextResponse.json({
        usageProfileId: profile.id,
        quotes: [],
        monthlyKwh: kwh,
      })
    }

    // Rank plans by estimated annual cost
    const ranked = plans
      .map(plan => {
        const cost = calculateMonthlyCost(
          {
            base_monthly_charge: plan.base_monthly_charge,
            energy_charge_per_kwh: plan.energy_charge_per_kwh,
            tdu_charges_per_kwh: plan.tdu_charges_per_kwh,
            tdu_monthly_charge: plan.tdu_monthly_charge,
            bill_credit_amount: plan.bill_credit_amount,
            bill_credit_threshold: plan.bill_credit_threshold,
            rate_500_kwh: plan.rate_500_kwh,
            rate_1000_kwh: plan.rate_1000_kwh,
            rate_2000_kwh: plan.rate_2000_kwh,
            cancellation_fee: plan.cancellation_fee,
            term_months: plan.term_months,
          },
          kwh
        )
        return { plan, cost }
      })
      .sort((a, b) => a.cost.estimatedAnnualCost - b.cost.estimatedAnnualCost)
      .slice(0, MAX_RESULTS)

    // Persist quotes
    const quoteInserts: QuoteInsert[] = ranked.map(({ plan, cost }, i) => ({
      usage_profile_id: profile.id,
      plan_id: plan.id,
      estimated_monthly_bill: cost.estimatedMonthlyBill,
      estimated_annual_cost: cost.estimatedAnnualCost,
      effective_rate_per_kwh: cost.effectiveRatePerKwh,
      rank: i + 1,
      rank_reason: rankReason(i + 1, plan),
    }))

    const insertedQuotes = await insertQuotes(quoteInserts)

    // Build response — join quote IDs with plan data
    const quotes = insertedQuotes.map((quote, i) => ({
      quoteId: quote.id,
      rank: quote.rank,
      rankReason: quote.rank_reason,
      estimatedMonthlyBill: quote.estimated_monthly_bill,
      estimatedAnnualCost: quote.estimated_annual_cost,
      effectiveRatePerKwh: quote.effective_rate_per_kwh,
      plan: {
        id: ranked[i].plan.id,
        name: ranked[i].plan.name,
        planType: ranked[i].plan.plan_type,
        termMonths: ranked[i].plan.term_months,
        renewablePercent: ranked[i].plan.renewable_percent,
        cancellationFee: ranked[i].plan.cancellation_fee,
        eflUrl: ranked[i].plan.efl_url,
        enrollmentUrl: ranked[i].plan.enrollment_url,
        gotchas: [
          ...(ranked[i].plan.gotchas ?? []),
          ...extractUsageSpecificGotchas(ranked[i].plan as PlanForGotchas, kwh),
        ],
        provider: {
          name: ranked[i].plan.provider?.name ?? 'Unknown',
          logoUrl: ranked[i].plan.provider?.logo_url ?? null,
        },
      },
    }))

    const response = NextResponse.json({
      usageProfileId: profile.id,
      quotes,
      monthlyKwh: kwh,
    })

    // Attach session cookie to response if it was just created
    // (getOrCreateSessionId already handles this via cookies() — nothing extra needed here)
    return response
  } catch (err) {
    console.error('[/api/compare] Error:', err)
    return NextResponse.json(
      { error: 'Failed to load plans. Please try again.' },
      { status: 500 }
    )
  }
}
