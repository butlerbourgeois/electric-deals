import { calculateMonthlyCost, PlanRateInputs } from './index'

// Base shape with all required fields zeroed/nulled.
// Individual tests override only what they care about.
const base: PlanRateInputs = {
  base_monthly_charge: 0,
  energy_charge_per_kwh: null,
  tdu_charges_per_kwh: null,
  tdu_monthly_charge: null,
  bill_credit_amount: null,
  bill_credit_threshold: null,
  rate_500_kwh: null,
  rate_1000_kwh: null,
  rate_2000_kwh: null,
  cancellation_fee: 0,
  term_months: 12,
}

describe('Ranking invariants: sort by projected cost, not headline rate', () => {
  /**
   * Test 1: A $100/mo bill credit makes the nominally higher-rate plan
   * cheaper in practice once usage clears the credit threshold.
   *
   * Plan A: 12.0¢/kWh anchor rate, no credit
   * Plan B: component-based at 0.08 + 0.045 ¢/kWh + $3.50 TDU, $100 credit at ≥1000 kWh
   *
   * At 1200 kWh:
   *   Plan A: 12.0 * 1200 / 100 = $144/mo → $1,728/yr
   *   Plan B: (0.08 * 1200) + (0.045 * 1200) + 3.50 − 100
   *         = 96 + 54 + 3.50 − 100 = $53.50/mo → $642/yr
   */
  test('bill-credit plan beats lower-rate plan when usage exceeds threshold', () => {
    const planA: PlanRateInputs = {
      ...base,
      rate_1000_kwh: 12.0,
    }

    const planB: PlanRateInputs = {
      ...base,
      energy_charge_per_kwh: 0.08,
      tdu_charges_per_kwh: 0.045,
      tdu_monthly_charge: 3.50,
      bill_credit_amount: 100,
      bill_credit_threshold: 1000,
    }

    const costA = calculateMonthlyCost(planA, 1200).estimatedAnnualCost
    const costB = calculateMonthlyCost(planB, 1200).estimatedAnnualCost

    // Plan B's $100/mo credit ($1,200/yr) swamps its higher rate
    expect(costB).toBeLessThan(costA)
  })

  /**
   * Test 2: A $20/mo base charge makes the lower-rate plan more expensive
   * at low usage, where the rate advantage is worth less than the fixed cost.
   *
   * Plan A: 10.0¢/kWh anchor rate, $0 base
   * Plan B: component-based at 7¢/kWh combined (→ 9¢ all-in at 1000 kWh), $20 base
   *
   * At 500 kWh:
   *   Plan A: 10.0 * 500 / 100 = $50/mo → $600/yr
   *   Plan B: (0.045 * 500) + (0.025 * 500) + 20
   *         = 22.50 + 12.50 + 20 = $55/mo → $660/yr
   *
   * The $20 fixed base adds $240/yr and overwhelms the 1¢ rate advantage.
   */
  test('base charge makes low-rate plan worse at low usage', () => {
    const planA: PlanRateInputs = {
      ...base,
      rate_1000_kwh: 10.0,
    }

    // Component rates chosen so (e+t)*1000 + 20 = $90/mo → 9.0¢ at 1000 kWh
    const planB: PlanRateInputs = {
      ...base,
      base_monthly_charge: 20,
      energy_charge_per_kwh: 0.045,
      tdu_charges_per_kwh: 0.025,
      tdu_monthly_charge: null,
    }

    const costA = calculateMonthlyCost(planA, 500).estimatedAnnualCost
    const costB = calculateMonthlyCost(planB, 500).estimatedAnnualCost

    // Plan A is cheaper despite Plan B's nominally lower per-kWh rate
    expect(costA).toBeLessThan(costB)
  })

  /**
   * Test 3: Interpolation between anchor points is monotonically increasing —
   * using 1500 kWh costs strictly more than using 1000 kWh.
   *
   * bill at 1000 = 11.5 * 1000 / 100 = $115 → $1,380/yr
   * bill at 1500 = interpolate(1000→2000): 115 + 0.5 * (204 − 115) = $159.50 → $1,914/yr
   */
  test('interpolation gives strictly higher cost at 1500 than 1000 kWh', () => {
    const plan: PlanRateInputs = {
      ...base,
      rate_500_kwh: 13.5,
      rate_1000_kwh: 11.5,
      rate_2000_kwh: 10.2,
    }

    const annualAt1000 = calculateMonthlyCost(plan, 1000).estimatedAnnualCost
    const annualAt1500 = calculateMonthlyCost(plan, 1500).estimatedAnnualCost

    expect(annualAt1500).toBeGreaterThan(annualAt1000)
  })

  /**
   * Test 4: Ranking is deterministic — sorting the same plans by projected
   * annual cost twice always produces the same order.
   *
   * This guards against any accidental state mutation or sort instability
   * that would make results differ between renders.
   */
  test('ordering is deterministic across two independent sorts', () => {
    const rates = [11.2, 13.5, 9.8, 12.1, 10.6]

    const plans: PlanRateInputs[] = rates.map((rate) => ({
      ...base,
      rate_1000_kwh: rate,
    }))

    const sortByAnnualCost = (ps: PlanRateInputs[]) =>
      [...ps].sort(
        (a, b) =>
          calculateMonthlyCost(a, 1000).estimatedAnnualCost -
          calculateMonthlyCost(b, 1000).estimatedAnnualCost
      )

    const firstSort = sortByAnnualCost(plans).map((p) => p.rate_1000_kwh)
    const secondSort = sortByAnnualCost(plans).map((p) => p.rate_1000_kwh)

    expect(firstSort).toEqual(secondSort)
    // Sanity check: the cheapest rate ends up first
    expect(firstSort[0]).toBe(9.8)
  })
})
