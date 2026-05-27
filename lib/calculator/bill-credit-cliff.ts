import { calculateMonthlyCost, PlanRateInputs } from './index'

export interface CliffAnalysis {
  hasCliff: boolean
  thresholdKwh: number | null
  creditAmount: number | null
  swingDollars: number      // monthly bill difference: just-below-threshold vs. at-threshold
  ratioSwing: number        // swingDollars / billAtThreshold (0.33 = 33% jump)
  isHighRisk: boolean       // true if swingDollars >= 25 OR ratioSwing >= 0.15
}

/**
 * Detects whether a plan has a "bill credit cliff" — a scenario where
 * missing a kWh threshold by even 50 kWh causes a meaningful bill spike.
 *
 * We quantify risk by computing the bill at the threshold (with credit) vs.
 * the bill 50 kWh below it (without credit) and measuring the absolute and
 * relative swing. This mirrors what a real customer experiences when their
 * usage dips slightly in a mild month.
 */
export function analyzeBillCreditCliff(plan: PlanRateInputs): CliffAnalysis {
  // No credit means no cliff
  if (plan.bill_credit_amount === null || plan.bill_credit_amount <= 0) {
    return {
      hasCliff: false,
      thresholdKwh: null,
      creditAmount: null,
      swingDollars: 0,
      ratioSwing: 0,
      isHighRisk: false,
    }
  }

  const threshold = plan.bill_credit_threshold ?? 1000
  const justBelow = Math.max(1, threshold - 50)

  const billAtThreshold = calculateMonthlyCost(plan, threshold).estimatedMonthlyBill
  const billJustBelow = calculateMonthlyCost(plan, justBelow).estimatedMonthlyBill

  // Positive swing = you pay more when you're just below the threshold
  const swingDollars = Math.max(0, billJustBelow - billAtThreshold)
  const ratioSwing = billAtThreshold > 0 ? swingDollars / billAtThreshold : 0
  const isHighRisk = swingDollars >= 25 || ratioSwing >= 0.15

  return {
    hasCliff: true,
    thresholdKwh: threshold,
    creditAmount: plan.bill_credit_amount,
    swingDollars,
    ratioSwing,
    isHighRisk,
  }
}
