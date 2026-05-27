/**
 * Texas Electricity Cost Calculator
 *
 * Computes the true estimated monthly cost for a plan at a given usage level.
 *
 * The math (per Texas PUC EFL standard):
 *   monthly_cost = base_charge
 *                + (energy_charge_per_kwh × kwh)
 *                + (tdu_charges_per_kwh × kwh)
 *                + tdu_monthly_charge
 *                - bill_credit (if kwh >= bill_credit_threshold)
 *
 * When exact component rates are unavailable (PTC anchor-point plans),
 * we interpolate between the 500/1000/2000 kWh anchor points.
 */

export interface PlanRateInputs {
  base_monthly_charge: number
  energy_charge_per_kwh: number | null
  tdu_charges_per_kwh: number | null
  tdu_monthly_charge: number | null
  bill_credit_amount: number | null
  bill_credit_threshold: number | null
  // PTC anchor points (fallback when per-kwh components not available)
  rate_500_kwh: number | null   // cents per kWh at 500 usage (ALL-IN)
  rate_1000_kwh: number | null  // cents per kWh at 1000 usage (ALL-IN)
  rate_2000_kwh: number | null  // cents per kWh at 2000 usage (ALL-IN)
  cancellation_fee: number
  term_months: number
}

export interface CostResult {
  estimatedMonthlyBill: number    // dollars
  estimatedAnnualCost: number     // dollars
  effectiveRatePerKwh: number     // cents per kWh (all-in)
  calculationMethod: 'components' | 'interpolated' | 'anchor'
  breakdown: {
    baseCharge: number
    energyCharge: number
    tduCharge: number
    billCredit: number
    total: number
  }
}

/**
 * Primary calculation: uses explicit component rates if available,
 * falls back to interpolation between PTC anchor points.
 */
export function calculateMonthlyCost(
  plan: PlanRateInputs,
  monthlyKwh: number
): CostResult {
  // Method 1: component-based (most accurate)
  if (
    plan.energy_charge_per_kwh !== null &&
    plan.tdu_charges_per_kwh !== null
  ) {
    return calculateFromComponents(plan, monthlyKwh)
  }

  // Method 2: interpolate from PTC anchor points
  if (plan.rate_500_kwh !== null && plan.rate_1000_kwh !== null) {
    return calculateFromAnchorPoints(plan, monthlyKwh)
  }

  // Method 3: use closest anchor point (last resort)
  return calculateFromNearestAnchor(plan, monthlyKwh)
}

function calculateFromComponents(
  plan: PlanRateInputs,
  kwh: number
): CostResult {
  const baseCharge = plan.base_monthly_charge
  const energyCharge = (plan.energy_charge_per_kwh! * kwh)
  const tduKwhCharge = (plan.tdu_charges_per_kwh! * kwh)
  const tduMonthlyCharge = plan.tdu_monthly_charge ?? 0
  const tduCharge = tduKwhCharge + tduMonthlyCharge

  const billCredit =
    plan.bill_credit_amount !== null &&
    plan.bill_credit_threshold !== null &&
    kwh >= plan.bill_credit_threshold
      ? plan.bill_credit_amount
      : 0

  const total = Math.max(0, baseCharge + energyCharge + tduCharge - billCredit)
  const effectiveRatePerKwh = kwh > 0 ? (total / kwh) * 100 : 0

  return {
    estimatedMonthlyBill: round2(total),
    estimatedAnnualCost: round2(total * 12),
    effectiveRatePerKwh: round4(effectiveRatePerKwh),
    calculationMethod: 'components',
    breakdown: {
      baseCharge: round2(baseCharge),
      energyCharge: round2(energyCharge),
      tduCharge: round2(tduCharge),
      billCredit: round2(billCredit),
      total: round2(total),
    },
  }
}

function calculateFromAnchorPoints(
  plan: PlanRateInputs,
  kwh: number
): CostResult {
  // PTC all-in rates are in cents/kWh. Convert total bill = rate * kwh / 100
  // Then back-compute the effective rate at the requested usage via interpolation.

  const rate500 = plan.rate_500_kwh!    // cents/kWh at 500
  const rate1000 = plan.rate_1000_kwh!  // cents/kWh at 1000
  const rate2000 = plan.rate_2000_kwh   // cents/kWh at 2000 (may be null)

  // Total bill at anchor points (dollars)
  const bill500 = (rate500 * 500) / 100
  const bill1000 = (rate1000 * 1000) / 100
  const bill2000 = rate2000 !== null ? (rate2000 * 2000) / 100 : null

  let estimatedBill: number

  if (kwh <= 500) {
    // Extrapolate below 500 using 500→1000 slope
    const slope = (bill1000 - bill500) / 500
    estimatedBill = bill500 + slope * (kwh - 500)
  } else if (kwh <= 1000) {
    // Linear interpolation 500→1000
    const t = (kwh - 500) / 500
    estimatedBill = bill500 + t * (bill1000 - bill500)
  } else if (kwh <= 2000 && bill2000 !== null) {
    // Linear interpolation 1000→2000
    const t = (kwh - 1000) / 1000
    estimatedBill = bill1000 + t * (bill2000 - bill1000)
  } else if (kwh <= 2000) {
    // Only 500+1000 anchors; extrapolate
    const slope = (bill1000 - bill500) / 500
    estimatedBill = bill1000 + slope * (kwh - 1000)
  } else {
    // Above 2000: extrapolate from 1000→2000 slope (or 500→1000)
    const anchorHigh = bill2000 ?? bill1000
    const anchorHighKwh = bill2000 !== null ? 2000 : 1000
    const anchorLow = bill2000 !== null ? bill1000 : bill500
    const anchorLowKwh = bill2000 !== null ? 1000 : 500
    const slope = (anchorHigh - anchorLow) / (anchorHighKwh - anchorLowKwh)
    estimatedBill = anchorHigh + slope * (kwh - anchorHighKwh)
  }

  // Apply bill credit on top of interpolated bill
  const billCredit =
    plan.bill_credit_amount !== null &&
    plan.bill_credit_threshold !== null &&
    kwh >= plan.bill_credit_threshold
      ? plan.bill_credit_amount
      : 0

  const total = Math.max(0, estimatedBill - billCredit)
  const effectiveRatePerKwh = kwh > 0 ? (total / kwh) * 100 : 0

  return {
    estimatedMonthlyBill: round2(total),
    estimatedAnnualCost: round2(total * 12),
    effectiveRatePerKwh: round4(effectiveRatePerKwh),
    calculationMethod: 'interpolated',
    breakdown: {
      baseCharge: plan.base_monthly_charge,
      energyCharge: round2(estimatedBill - plan.base_monthly_charge),
      tduCharge: 0, // absorbed into anchor rates
      billCredit: round2(billCredit),
      total: round2(total),
    },
  }
}

function calculateFromNearestAnchor(
  plan: PlanRateInputs,
  kwh: number
): CostResult {
  // Use whichever anchor point we have — guard against stored-zero rates
  const nonZero = (v: number | null): number | null => (v != null && v > 0 ? v : null)
  const rate =
    nonZero(plan.rate_1000_kwh) ??
    nonZero(plan.rate_500_kwh) ??
    nonZero(plan.rate_2000_kwh) ??
    12 // absolute fallback: 12 cents/kWh

  const total = (rate * kwh) / 100
  const effectiveRatePerKwh = rate

  return {
    estimatedMonthlyBill: round2(total),
    estimatedAnnualCost: round2(total * 12),
    effectiveRatePerKwh: round4(effectiveRatePerKwh),
    calculationMethod: 'anchor',
    breakdown: {
      baseCharge: 0,
      energyCharge: round2(total),
      tduCharge: 0,
      billCredit: 0,
      total: round2(total),
    },
  }
}

/**
 * Convert a dollar bill amount + home type into an estimated kWh figure.
 * Uses Texas average rates as a baseline.
 */
export function estimateKwhFromBill(
  monthlyBill: number,
  homeType: 'apartment' | 'small_home' | 'large_home'
): number {
  // Average all-in TX electricity rate ~ 13.5 cents/kWh
  // Adjust baseline kWh by home type
  const avgRateCents = 13.5

  // Raw estimate from bill amount
  const rawKwh = (monthlyBill / avgRateCents) * 100

  // Home type plausibility bounds (monthly kWh)
  const bounds: Record<string, [number, number]> = {
    apartment:  [300, 1200],
    small_home: [500, 1800],
    large_home: [800, 3000],
  }

  const [min, max] = bounds[homeType]
  return Math.round(Math.min(max, Math.max(min, rawKwh)))
}

// Helpers
function round2(n: number): number { return Math.round(n * 100) / 100 }
function round4(n: number): number { return Math.round(n * 10000) / 10000 }
