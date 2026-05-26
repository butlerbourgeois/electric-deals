import { calculateMonthlyCost, estimateKwhFromBill, PlanRateInputs } from './index'

// A real-ish fixed-rate plan: 11.9¢/kWh all-in, no bill credit, $9.95 base
const simplePlan: PlanRateInputs = {
  base_monthly_charge: 9.95,
  energy_charge_per_kwh: 0.0795,   // energy component
  tdu_charges_per_kwh: 0.0395,     // TDU passthrough
  tdu_monthly_charge: 3.42,
  bill_credit_amount: null,
  bill_credit_threshold: null,
  rate_500_kwh: 11.9,
  rate_1000_kwh: 11.9,
  rate_2000_kwh: 11.9,
  cancellation_fee: 150,
  term_months: 12,
}

// A plan with bill credit: $100 credit at 1000+ kWh
const billCreditPlan: PlanRateInputs = {
  base_monthly_charge: 4.95,
  energy_charge_per_kwh: 0.09,
  tdu_charges_per_kwh: 0.04,
  tdu_monthly_charge: 3.42,
  bill_credit_amount: 100,
  bill_credit_threshold: 1000,
  rate_500_kwh: 18.5,
  rate_1000_kwh: 7.3,   // looks cheap at 1000 because of $100 credit
  rate_2000_kwh: 9.6,
  cancellation_fee: 150,
  term_months: 12,
}

// Anchor-point only plan (no component rates)
const anchorOnlyPlan: PlanRateInputs = {
  base_monthly_charge: 0,
  energy_charge_per_kwh: null,
  tdu_charges_per_kwh: null,
  tdu_monthly_charge: null,
  bill_credit_amount: null,
  bill_credit_threshold: null,
  rate_500_kwh: 14.2,
  rate_1000_kwh: 12.1,
  rate_2000_kwh: 11.5,
  cancellation_fee: 200,
  term_months: 24,
}

describe('calculateMonthlyCost — component method', () => {
  test('calculates correctly at 1000 kWh', () => {
    const result = calculateMonthlyCost(simplePlan, 1000)
    // 9.95 + (0.0795 * 1000) + (0.0395 * 1000) + 3.42 = 9.95 + 79.5 + 39.5 + 3.42 = 132.37
    expect(result.estimatedMonthlyBill).toBeCloseTo(132.37, 1)
    expect(result.calculationMethod).toBe('components')
    expect(result.estimatedAnnualCost).toBeCloseTo(132.37 * 12, 1)
  })

  test('effective rate matches expected all-in rate', () => {
    const result = calculateMonthlyCost(simplePlan, 1000)
    // effective = 132.37 / 1000 * 100 = 13.237 cents/kWh
    expect(result.effectiveRatePerKwh).toBeGreaterThan(12)
    expect(result.effectiveRatePerKwh).toBeLessThan(15)
  })

  test('applies bill credit when threshold met', () => {
    const withCredit = calculateMonthlyCost(billCreditPlan, 1000)
    const withoutCredit = calculateMonthlyCost(billCreditPlan, 999)
    expect(withCredit.estimatedMonthlyBill).toBeLessThan(withoutCredit.estimatedMonthlyBill)
    expect(withCredit.breakdown.billCredit).toBe(100)
    expect(withoutCredit.breakdown.billCredit).toBe(0)
  })

  test('bill never goes negative', () => {
    const result = calculateMonthlyCost(billCreditPlan, 1)
    expect(result.estimatedMonthlyBill).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateMonthlyCost — interpolation method', () => {
  test('interpolates correctly between 500 and 1000', () => {
    const result = calculateMonthlyCost(anchorOnlyPlan, 750)
    // bill at 500 = 14.2 * 500 / 100 = $71
    // bill at 1000 = 12.1 * 1000 / 100 = $121
    // at 750 = midpoint = $96
    expect(result.estimatedMonthlyBill).toBeCloseTo(96, 0)
    expect(result.calculationMethod).toBe('interpolated')
  })

  test('interpolates correctly between 1000 and 2000', () => {
    const result = calculateMonthlyCost(anchorOnlyPlan, 1500)
    // bill at 1000 = $121, bill at 2000 = 11.5 * 2000 / 100 = $230
    // at 1500 = midpoint = $175.5
    expect(result.estimatedMonthlyBill).toBeCloseTo(175.5, 0)
  })

  test('annual cost is 12x monthly', () => {
    const result = calculateMonthlyCost(anchorOnlyPlan, 1000)
    expect(result.estimatedAnnualCost).toBeCloseTo(result.estimatedMonthlyBill * 12, 1)
  })
})

describe('estimateKwhFromBill', () => {
  test('estimates kWh from dollar amount', () => {
    // $135 / 13.5 cents/kWh * 100 = 1000 kWh
    const result = estimateKwhFromBill(135, 'small_home')
    expect(result).toBeGreaterThan(800)
    expect(result).toBeLessThan(1200)
  })

  test('clamps to plausible range for home type', () => {
    // Unrealistically high bill for apartment
    const result = estimateKwhFromBill(500, 'apartment')
    expect(result).toBeLessThanOrEqual(1200)

    // Unrealistically low for large home
    const result2 = estimateKwhFromBill(5, 'large_home')
    expect(result2).toBeGreaterThanOrEqual(800)
  })
})
