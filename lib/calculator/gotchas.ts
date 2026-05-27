import { Gotcha } from '@/types/database'
import { PlanRateInputs } from './index'
import { analyzeBillCreditCliff } from './bill-credit-cliff'

// Plan fields needed for gotcha extraction (subset of PlanRateInputs + plan_type)
export interface PlanForGotchas extends PlanRateInputs {
  plan_type: 'fixed' | 'variable' | 'indexed' | 'tou'
}

// Severity ordering for the stable sort: high < medium < low
const SEVERITY_ORDER: Record<Gotcha['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/**
 * Extracts static gotchas for a plan at ingest time.
 * These are plan-level warnings that apply regardless of a specific user's usage.
 *
 * Rules applied (in detection order):
 *   1. bill_credit_cliff       — high swing if user misses the credit threshold
 *   2. rate_doubles_low_usage  — rate_500 is 1.5x+ higher than rate_1000
 *   3. high_base_charge        — base monthly charge >= $9.95
 *   4. high_etf                — ETF >= $250 on a 12+ month contract
 *   5. teaser_rate_short_term  — variable plan with <= 3-month term
 *   6. tdu_charge_buried_in_rate — no per-kWh component breakdown
 */
export function extractGotchas(plan: PlanForGotchas): Gotcha[] {
  const gotchas: Gotcha[] = []

  // Rule 1: bill_credit_cliff
  const cliff = analyzeBillCreditCliff(plan)
  if (cliff.isHighRisk) {
    const threshold = cliff.thresholdKwh!
    const credit = cliff.creditAmount!
    const swing = cliff.swingDollars
    gotchas.push({
      code: 'bill_credit_cliff',
      severity: swing >= 50 ? 'high' : 'medium',
      title: `Rate jumps if you use less than ${threshold.toLocaleString()} kWh/month`,
      detail: `This plan gives a $${credit} credit only at ${threshold.toLocaleString()}+ kWh. If your usage dips by 50 kWh, your bill jumps ~$${Math.round(swing)}.`,
      threshold_kwh: threshold,
      swing_dollars: swing,
    })
  }

  // Rule 2: rate_doubles_low_usage
  if (
    plan.rate_500_kwh != null &&
    plan.rate_1000_kwh != null &&
    plan.rate_500_kwh / plan.rate_1000_kwh >= 1.5
  ) {
    const r500 = plan.rate_500_kwh
    const r1000 = plan.rate_1000_kwh
    const pctMore = Math.round((r500 / r1000 - 1) * 100)
    gotchas.push({
      code: 'rate_doubles_low_usage',
      severity: 'high',
      title: 'Rate nearly doubles at low usage',
      detail: `At 500 kWh/month, this plan charges ${r500.toFixed(1)}¢/kWh — ${pctMore}% more than at 1,000 kWh. Low-usage months are disproportionately expensive.`,
    })
  }

  // Rule 3: high_base_charge
  if (plan.base_monthly_charge >= 9.95) {
    gotchas.push({
      code: 'high_base_charge',
      severity: 'medium',
      title: `$${plan.base_monthly_charge.toFixed(2)}/month base charge`,
      detail: `This plan charges $${plan.base_monthly_charge.toFixed(2)} every month regardless of usage. At low usage, this significantly raises your effective rate.`,
    })
  }

  // Rule 4: high_etf
  if (plan.cancellation_fee >= 250 && plan.term_months >= 12) {
    gotchas.push({
      code: 'high_etf',
      severity: 'medium',
      title: `$${plan.cancellation_fee} early termination fee`,
      detail: `Leaving this plan before the ${plan.term_months}-month contract ends costs $${plan.cancellation_fee}. Make sure you're confident in the rate before enrolling.`,
    })
  }

  // Rule 5: teaser_rate_short_term
  if (plan.plan_type === 'variable' && plan.term_months <= 3) {
    gotchas.push({
      code: 'teaser_rate_short_term',
      severity: 'high',
      title: 'Variable rate — can change monthly',
      detail: `This plan's rate is not locked in. Variable plans commonly start low then increase. After ${plan.term_months} month${plan.term_months !== 1 ? 's' : ''}, your rate could change significantly.`,
    })
  }

  // Rule 6: tdu_charge_buried_in_rate
  // Applies when there are no per-kWh component rates but we do have anchor-point rates.
  // If we have neither components nor anchors, the plan is essentially unusable anyway.
  if (
    plan.energy_charge_per_kwh === null &&
    plan.tdu_charges_per_kwh === null &&
    plan.rate_1000_kwh != null
  ) {
    gotchas.push({
      code: 'tdu_charge_buried_in_rate',
      severity: 'low',
      title: 'Rate bundles delivery charges',
      detail: "This plan's headline rate includes TDU delivery charges. The exact energy vs. delivery breakdown isn't available, which makes it harder to compare apples-to-apples.",
    })
  }

  // Stable sort: high → medium → low, preserving original order within same severity
  return gotchas.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

/**
 * Extracts usage-specific gotchas computed at compare-time, when we know the
 * user's actual monthly kWh. These are NOT stored at ingest — they're generated
 * on the fly while rendering the comparison page.
 *
 * Rules:
 *   - usage_near_cliff: user's usage is within 100 kWh of the bill credit threshold
 */
export function extractUsageSpecificGotchas(
  plan: PlanForGotchas,
  monthlyKwh: number
): Gotcha[] {
  const gotchas: Gotcha[] = []

  if (
    plan.bill_credit_amount != null &&
    plan.bill_credit_amount > 0 &&
    plan.bill_credit_threshold != null
  ) {
    const threshold = plan.bill_credit_threshold
    const credit = plan.bill_credit_amount
    const distance = Math.abs(monthlyKwh - threshold)

    if (distance <= 100) {
      if (monthlyKwh < threshold) {
        // User is below the threshold — they're missing the credit
        const shortfall = threshold - monthlyKwh
        gotchas.push({
          code: 'usage_near_cliff',
          severity: 'high',
          title: `You're ${shortfall} kWh short of the $${credit} bill credit`,
          detail: `At your usage (${monthlyKwh} kWh), you'd miss the $${credit} credit. That's ~$${Math.round(credit)} more per month than the headline suggests.`,
          threshold_kwh: threshold,
          swing_dollars: credit,
        })
      } else {
        // User is at or above threshold (within 100 kWh) — they qualify but it's fragile
        gotchas.push({
          code: 'usage_near_cliff',
          severity: 'high',
          title: `Your usage is just above the $${credit} credit threshold`,
          detail: `At ${monthlyKwh} kWh you qualify for the $${credit} credit, but if your usage dips in a mild month you'd lose it — a $${Math.round(credit)} swing.`,
          threshold_kwh: threshold,
          swing_dollars: credit,
        })
      }
    }
  }

  return gotchas
}
