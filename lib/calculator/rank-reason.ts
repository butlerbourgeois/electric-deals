import { PlanWithProvider } from '@/types/database'

/**
 * Produces a short human-readable string explaining why this plan was ranked here.
 * This is stored in quote.rank_reason and displayed in the UI.
 */
export function rankReason(rank: number, plan: PlanWithProvider): string {
  if (rank === 1) {
    if (plan.renewable_percent === 100) return 'lowest annual cost · 100% renewable'
    return 'lowest annual cost'
  }
  if (plan.renewable_percent === 100 && rank <= 5) return `#${rank} lowest cost · 100% renewable`
  if (plan.plan_type === 'fixed') return `#${rank} lowest cost · fixed rate`
  if (plan.plan_type === 'variable') return `#${rank} lowest cost · flexible term`
  return `#${rank} lowest cost`
}
