import { analyzeBillCreditCliff } from './bill-credit-cliff'
import { PlanRateInputs } from './index'

// Shared base for component-based plans
const baseComponentPlan: PlanRateInputs = {
  base_monthly_charge: 4.95,
  energy_charge_per_kwh: 0.09,
  tdu_charges_per_kwh: 0.04,
  tdu_monthly_charge: 3.42,
  bill_credit_amount: null,
  bill_credit_threshold: null,
  rate_500_kwh: null,
  rate_1000_kwh: null,
  rate_2000_kwh: null,
  cancellation_fee: 150,
  term_months: 12,
}

// Anchor-point-only plan base
const baseAnchorPlan: PlanRateInputs = {
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

describe('analyzeBillCreditCliff', () => {
  // Case 1: No credit — hasCliff must be false, all zeroes
  test('no credit → hasCliff false with zeroed fields', () => {
    const plan: PlanRateInputs = { ...baseComponentPlan, bill_credit_amount: null }
    const result = analyzeBillCreditCliff(plan)
    expect(result.hasCliff).toBe(false)
    expect(result.thresholdKwh).toBeNull()
    expect(result.creditAmount).toBeNull()
    expect(result.swingDollars).toBe(0)
    expect(result.ratioSwing).toBe(0)
    expect(result.isHighRisk).toBe(false)
  })

  // Case 6: credit amount = 0 → hasCliff false (guard against zero-value credits)
  test('credit amount = 0 → hasCliff false', () => {
    const plan: PlanRateInputs = {
      ...baseComponentPlan,
      bill_credit_amount: 0,
      bill_credit_threshold: 1000,
    }
    const result = analyzeBillCreditCliff(plan)
    expect(result.hasCliff).toBe(false)
    expect(result.isHighRisk).toBe(false)
  })

  // Case 2: Small $10 credit at 1000 kWh — hasCliff true but isHighRisk false
  // At 1000 kWh: base(4.95) + energy(0.09*1000=90) + tdu(0.04*1000+3.42=43.42) - credit(10) = 128.37
  // At 950 kWh:  base(4.95) + energy(0.09*950=85.5) + tdu(0.04*950+3.42=41.42) - credit(0) = 131.89
  // swing = 131.89 - 128.37 = 3.52 → well below $25 and 15%
  test('small $10 credit at 1000 kWh → hasCliff true, isHighRisk false', () => {
    const plan: PlanRateInputs = {
      ...baseComponentPlan,
      bill_credit_amount: 10,
      bill_credit_threshold: 1000,
    }
    const result = analyzeBillCreditCliff(plan)
    expect(result.hasCliff).toBe(true)
    expect(result.thresholdKwh).toBe(1000)
    expect(result.creditAmount).toBe(10)
    // swing ≈ 10 - (cost of 50 kWh ≈ 6.5) so modest
    expect(result.swingDollars).toBeGreaterThan(0)
    expect(result.swingDollars).toBeLessThan(25)
    expect(result.isHighRisk).toBe(false)
  })

  // Case 3: Large $100 credit at 1000 kWh (component-based) → isHighRisk true
  // At 1000 kWh: 4.95 + 90 + 43.42 - 100 = 38.37
  // At 950 kWh:  4.95 + 85.5 + 41.42 - 0  = 131.87
  // swing = 131.87 - 38.37 = ~93.5 → definitely high risk
  test('large $100 credit at 1000 kWh → isHighRisk true, swingDollars ~90-100', () => {
    const plan: PlanRateInputs = {
      ...baseComponentPlan,
      bill_credit_amount: 100,
      bill_credit_threshold: 1000,
    }
    const result = analyzeBillCreditCliff(plan)
    expect(result.hasCliff).toBe(true)
    expect(result.isHighRisk).toBe(true)
    expect(result.swingDollars).toBeGreaterThanOrEqual(85)
    expect(result.swingDollars).toBeLessThanOrEqual(100)
    // ratio: ~93 / 38 ≈ 2.4 → well above 0.15
    expect(result.ratioSwing).toBeGreaterThan(0.15)
  })

  // Case 4: Credit with threshold = 500 → works correctly
  // At 500 kWh: 4.95 + 0.09*500 + (0.04*500 + 3.42) - 50 = 4.95 + 45 + 23.42 - 50 = 23.37
  // At 450 kWh: 4.95 + 0.09*450 + (0.04*450 + 3.42) - 0  = 4.95 + 40.5 + 21.42     = 66.87
  // swing = 66.87 - 23.37 = 43.5 → isHighRisk true
  test('credit with threshold=500 → correctly computes cliff', () => {
    const plan: PlanRateInputs = {
      ...baseComponentPlan,
      bill_credit_amount: 50,
      bill_credit_threshold: 500,
    }
    const result = analyzeBillCreditCliff(plan)
    expect(result.hasCliff).toBe(true)
    expect(result.thresholdKwh).toBe(500)
    expect(result.creditAmount).toBe(50)
    expect(result.swingDollars).toBeGreaterThan(0)
    expect(result.isHighRisk).toBe(true)
  })

  // Case 5: Anchor-point plan with bill credit → interpolation path, still works
  // At 1000 kWh: bill1000 = 12.1 * 1000 / 100 = $121, minus $30 credit = $91
  // At 950 kWh: interpolated between bill500=$71 and bill1000=$121:
  //   t = (950-500)/500 = 0.9 → 71 + 0.9*50 = $116
  // swing = 116 - 91 = $25 → exactly on the boundary, isHighRisk true
  test('anchor-point plan with $30 credit at 1000 kWh → uses interpolation correctly', () => {
    const plan: PlanRateInputs = {
      ...baseAnchorPlan,
      bill_credit_amount: 30,
      bill_credit_threshold: 1000,
    }
    const result = analyzeBillCreditCliff(plan)
    expect(result.hasCliff).toBe(true)
    expect(result.thresholdKwh).toBe(1000)
    // swing = interpolated bill at 950 (no credit) minus bill at 1000 (with $30 credit)
    expect(result.swingDollars).toBeGreaterThan(0)
    // $30 credit with 50 kWh step on a ~12.1 cent plan → swing ≈ 30 - 6 = $24
    // (less than 25 but ratio check: 24/91 = 0.26 → isHighRisk true)
    expect(result.isHighRisk).toBe(true)
  })
})
