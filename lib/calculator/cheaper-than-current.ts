import { calculateMonthlyCost } from './index'
import { getActivePlansForTdu } from '@/lib/db/plans'

export interface CheaperPlanResult {
  planId: string
  planName: string
  providerName: string
  estimatedMonthlySavings: number  // positive = dollars saved vs current plan
  estimatedMonthlyBill: number
}

/**
 * Given a renewal alert's current plan + usage, returns the cheapest available
 * plan in the same TDU territory that is cheaper than the current plan.
 * Returns null if no cheaper plan is found or if the current plan cost cannot
 * be computed (e.g. no rates in DB).
 *
 * Designed to be called from the cron job before sending a renewal reminder.
 * When a cheaper plan is found, the email template surfaces the savings amount
 * as a concrete callout to motivate action.
 *
 * @param tduTerritory       - the alert's TDU territory
 * @param monthlyKwh         - the alert's usage in kWh
 * @param currentPlanId      - the plan the user is currently on (excluded from results)
 * @param currentMonthlyBill - pre-computed current monthly bill in dollars
 */
export async function findCheaperPlan(
  tduTerritory: string,
  monthlyKwh: number,
  currentPlanId: string,
  currentMonthlyBill: number
): Promise<CheaperPlanResult | null> {
  // Fetch all active plans for this TDU territory
  const plans = await getActivePlansForTdu(tduTerritory)

  if (plans.length === 0) return null

  // Exclude the user's current plan from the comparison
  const alternativePlans = plans.filter((p) => p.id !== currentPlanId)

  if (alternativePlans.length === 0) return null

  // Compute the monthly bill for each alternative plan
  type ScoredPlan = {
    planId: string
    planName: string
    providerName: string
    estimatedMonthlyBill: number
  }

  const scored: ScoredPlan[] = alternativePlans.map((plan) => ({
    planId: plan.id,
    planName: plan.name,
    providerName: plan.provider.name,
    estimatedMonthlyBill: calculateMonthlyCost(plan, monthlyKwh).estimatedMonthlyBill,
  }))

  // Sort ascending by estimated bill — cheapest first
  scored.sort((a, b) => a.estimatedMonthlyBill - b.estimatedMonthlyBill)

  const cheapest = scored[0]

  // Only surface the result if it's actually cheaper than the current plan
  if (cheapest.estimatedMonthlyBill >= currentMonthlyBill) return null

  return {
    planId: cheapest.planId,
    planName: cheapest.planName,
    providerName: cheapest.providerName,
    estimatedMonthlyBill: cheapest.estimatedMonthlyBill,
    estimatedMonthlySavings: Math.round((currentMonthlyBill - cheapest.estimatedMonthlyBill) * 100) / 100,
  }
}
