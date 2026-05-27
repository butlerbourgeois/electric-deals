import { extractGotchas, extractUsageSpecificGotchas, PlanForGotchas } from './gotchas'

// ──────────────────────────────────────────────────────────────────────────────
// Shared plan fixtures
// ──────────────────────────────────────────────────────────────────────────────

/** Minimal component-based fixed plan with no gotcha triggers */
const cleanPlan: PlanForGotchas = {
  plan_type: 'fixed',
  base_monthly_charge: 4.95,
  energy_charge_per_kwh: 0.09,
  tdu_charges_per_kwh: 0.04,
  tdu_monthly_charge: 3.42,
  bill_credit_amount: null,
  bill_credit_threshold: null,
  rate_500_kwh: 12.5,
  rate_1000_kwh: 11.5,
  rate_2000_kwh: 11.0,
  cancellation_fee: 150,
  term_months: 12,
}

// ──────────────────────────────────────────────────────────────────────────────
// Rule 1: bill_credit_cliff
// ──────────────────────────────────────────────────────────────────────────────

describe('Rule 1: bill_credit_cliff', () => {
  test('triggers for a high-risk $100 credit at 1000 kWh', () => {
    // At 1000 kWh: 4.95 + 90 + 43.42 - 100 = 38.37
    // At  950 kWh: 4.95 + 85.5 + 41.42      = 131.87 → swing ~93 → severity 'high'
    const plan: PlanForGotchas = {
      ...cleanPlan,
      bill_credit_amount: 100,
      bill_credit_threshold: 1000,
    }
    const gotchas = extractGotchas(plan)
    const cliff = gotchas.find(g => g.code === 'bill_credit_cliff')
    expect(cliff).toBeDefined()
    expect(cliff!.severity).toBe('high')
    expect(cliff!.threshold_kwh).toBe(1000)
    expect(cliff!.swing_dollars).toBeGreaterThan(50)
    expect(cliff!.title).toMatch(/1,000/)
  })

  test('triggers at medium severity for a $35 credit (swing ~29)', () => {
    // swing ≈ 35 - (energy cost of 50 kWh) ≈ 28.5 → >= 25 but < 50 → 'medium'
    const plan: PlanForGotchas = {
      ...cleanPlan,
      bill_credit_amount: 35,
      bill_credit_threshold: 1000,
    }
    const gotchas = extractGotchas(plan)
    const cliff = gotchas.find(g => g.code === 'bill_credit_cliff')
    expect(cliff).toBeDefined()
    expect(cliff!.severity).toBe('medium')
  })

  test('does NOT trigger when no credit is set', () => {
    const gotchas = extractGotchas(cleanPlan)
    expect(gotchas.find(g => g.code === 'bill_credit_cliff')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Rule 2: rate_doubles_low_usage
// ──────────────────────────────────────────────────────────────────────────────

describe('Rule 2: rate_doubles_low_usage', () => {
  test('triggers when rate_500 is 1.5x rate_1000', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      energy_charge_per_kwh: null,
      tdu_charges_per_kwh: null,
      rate_500_kwh: 18.0,   // 18.0 / 11.0 = ~1.64x
      rate_1000_kwh: 11.0,
    }
    const gotchas = extractGotchas(plan)
    const g = gotchas.find(g => g.code === 'rate_doubles_low_usage')
    expect(g).toBeDefined()
    expect(g!.severity).toBe('high')
    expect(g!.detail).toMatch(/18\.0¢/)
    expect(g!.detail).toMatch(/64%/)
  })

  test('does NOT trigger when rate_500 is only 1.2x rate_1000', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      energy_charge_per_kwh: null,
      tdu_charges_per_kwh: null,
      rate_500_kwh: 13.2,
      rate_1000_kwh: 11.0,
    }
    const gotchas = extractGotchas(plan)
    expect(gotchas.find(g => g.code === 'rate_doubles_low_usage')).toBeUndefined()
  })

  test('does NOT trigger when rate anchors are null', () => {
    const gotchas = extractGotchas(cleanPlan)
    expect(gotchas.find(g => g.code === 'rate_doubles_low_usage')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Rule 3: high_base_charge
// ──────────────────────────────────────────────────────────────────────────────

describe('Rule 3: high_base_charge', () => {
  test('triggers at exactly $9.95', () => {
    const plan: PlanForGotchas = { ...cleanPlan, base_monthly_charge: 9.95 }
    const gotchas = extractGotchas(plan)
    const g = gotchas.find(g => g.code === 'high_base_charge')
    expect(g).toBeDefined()
    expect(g!.severity).toBe('medium')
    expect(g!.title).toBe('$9.95/month base charge')
  })

  test('triggers at $14.95', () => {
    const plan: PlanForGotchas = { ...cleanPlan, base_monthly_charge: 14.95 }
    const gotchas = extractGotchas(plan)
    expect(gotchas.find(g => g.code === 'high_base_charge')).toBeDefined()
  })

  test('does NOT trigger below $9.95', () => {
    const plan: PlanForGotchas = { ...cleanPlan, base_monthly_charge: 4.95 }
    const gotchas = extractGotchas(plan)
    expect(gotchas.find(g => g.code === 'high_base_charge')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Rule 4: high_etf
// ──────────────────────────────────────────────────────────────────────────────

describe('Rule 4: high_etf', () => {
  test('triggers for $300 ETF on 24-month plan', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      cancellation_fee: 300,
      term_months: 24,
    }
    const gotchas = extractGotchas(plan)
    const g = gotchas.find(g => g.code === 'high_etf')
    expect(g).toBeDefined()
    expect(g!.severity).toBe('medium')
    expect(g!.title).toBe('$300 early termination fee')
    expect(g!.detail).toMatch(/24-month/)
  })

  test('triggers at the exact boundary: $250 on 12-month plan', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      cancellation_fee: 250,
      term_months: 12,
    }
    const gotchas = extractGotchas(plan)
    expect(gotchas.find(g => g.code === 'high_etf')).toBeDefined()
  })

  test('does NOT trigger for $300 ETF on short-term (< 12 month) plan', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      cancellation_fee: 300,
      term_months: 6,
    }
    const gotchas = extractGotchas(plan)
    expect(gotchas.find(g => g.code === 'high_etf')).toBeUndefined()
  })

  test('does NOT trigger for $200 ETF (below threshold)', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      cancellation_fee: 200,
      term_months: 24,
    }
    const gotchas = extractGotchas(plan)
    expect(gotchas.find(g => g.code === 'high_etf')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Rule 5: teaser_rate_short_term
// ──────────────────────────────────────────────────────────────────────────────

describe('Rule 5: teaser_rate_short_term', () => {
  test('triggers for variable plan with 1-month term', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      plan_type: 'variable',
      term_months: 1,
    }
    const gotchas = extractGotchas(plan)
    const g = gotchas.find(g => g.code === 'teaser_rate_short_term')
    expect(g).toBeDefined()
    expect(g!.severity).toBe('high')
    // Singular "month" form
    expect(g!.detail).toMatch(/After 1 month,/)
  })

  test('triggers for variable plan with 3-month term (plural)', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      plan_type: 'variable',
      term_months: 3,
    }
    const gotchas = extractGotchas(plan)
    const g = gotchas.find(g => g.code === 'teaser_rate_short_term')
    expect(g).toBeDefined()
    expect(g!.detail).toMatch(/After 3 months,/)
  })

  test('does NOT trigger for fixed plan', () => {
    const plan: PlanForGotchas = { ...cleanPlan, plan_type: 'fixed', term_months: 1 }
    const gotchas = extractGotchas(plan)
    expect(gotchas.find(g => g.code === 'teaser_rate_short_term')).toBeUndefined()
  })

  test('does NOT trigger for variable plan with 6-month term (above threshold)', () => {
    const plan: PlanForGotchas = { ...cleanPlan, plan_type: 'variable', term_months: 6 }
    const gotchas = extractGotchas(plan)
    expect(gotchas.find(g => g.code === 'teaser_rate_short_term')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Rule 6: tdu_charge_buried_in_rate
// ──────────────────────────────────────────────────────────────────────────────

describe('Rule 6: tdu_charge_buried_in_rate', () => {
  test('triggers for anchor-point plan with no component rates', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      energy_charge_per_kwh: null,
      tdu_charges_per_kwh: null,
      rate_500_kwh: 14.2,
      rate_1000_kwh: 12.1,
      rate_2000_kwh: 11.5,
    }
    const gotchas = extractGotchas(plan)
    const g = gotchas.find(g => g.code === 'tdu_charge_buried_in_rate')
    expect(g).toBeDefined()
    expect(g!.severity).toBe('low')
  })

  test('does NOT trigger when component rates are present', () => {
    // cleanPlan has component rates
    const gotchas = extractGotchas(cleanPlan)
    expect(gotchas.find(g => g.code === 'tdu_charge_buried_in_rate')).toBeUndefined()
  })

  test('does NOT trigger when no anchors available (no rate_1000_kwh)', () => {
    const plan: PlanForGotchas = {
      ...cleanPlan,
      energy_charge_per_kwh: null,
      tdu_charges_per_kwh: null,
      rate_500_kwh: null,
      rate_1000_kwh: null,
      rate_2000_kwh: null,
    }
    const gotchas = extractGotchas(plan)
    expect(gotchas.find(g => g.code === 'tdu_charge_buried_in_rate')).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Severity sort ordering
// ──────────────────────────────────────────────────────────────────────────────

describe('extractGotchas — severity ordering', () => {
  test('returns gotchas sorted high → medium → low', () => {
    // This plan should trigger: teaser_rate(high), high_base_charge(medium), tdu_buried(low)
    const plan: PlanForGotchas = {
      ...cleanPlan,
      plan_type: 'variable',
      term_months: 1,
      base_monthly_charge: 9.95,
      energy_charge_per_kwh: null,
      tdu_charges_per_kwh: null,
    }
    const gotchas = extractGotchas(plan)
    const severities = gotchas.map(g => g.severity)
    const ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
    for (let i = 1; i < severities.length; i++) {
      expect(ORDER[severities[i]]).toBeGreaterThanOrEqual(ORDER[severities[i - 1]])
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// extractUsageSpecificGotchas
// ──────────────────────────────────────────────────────────────────────────────

describe('extractUsageSpecificGotchas', () => {
  const creditPlan: PlanForGotchas = {
    ...cleanPlan,
    bill_credit_amount: 50,
    bill_credit_threshold: 1000,
  }

  test('user below threshold within 100 kWh → usage_near_cliff with shortfall message', () => {
    const gotchas = extractUsageSpecificGotchas(creditPlan, 950)
    expect(gotchas).toHaveLength(1)
    const g = gotchas[0]
    expect(g.code).toBe('usage_near_cliff')
    expect(g.severity).toBe('high')
    expect(g.title).toMatch(/50 kWh short/)
    expect(g.detail).toMatch(/950 kWh/)
    expect(g.threshold_kwh).toBe(1000)
    expect(g.swing_dollars).toBe(50)
  })

  test('user at threshold (exactly on boundary) → usage_near_cliff with fragile message', () => {
    const gotchas = extractUsageSpecificGotchas(creditPlan, 1000)
    expect(gotchas).toHaveLength(1)
    const g = gotchas[0]
    expect(g.code).toBe('usage_near_cliff')
    expect(g.title).toMatch(/just above/)
    expect(g.detail).toMatch(/1000 kWh/)
  })

  test('user above threshold within 100 kWh → usage_near_cliff with fragile message', () => {
    const gotchas = extractUsageSpecificGotchas(creditPlan, 1050)
    expect(gotchas).toHaveLength(1)
    const g = gotchas[0]
    expect(g.code).toBe('usage_near_cliff')
    expect(g.title).toMatch(/just above/)
    expect(g.swing_dollars).toBe(50)
  })

  test('user well above threshold (> 100 kWh away) → no gotcha', () => {
    const gotchas = extractUsageSpecificGotchas(creditPlan, 1200)
    expect(gotchas).toHaveLength(0)
  })

  test('user well below threshold (> 100 kWh away) → no gotcha', () => {
    const gotchas = extractUsageSpecificGotchas(creditPlan, 800)
    expect(gotchas).toHaveLength(0)
  })

  test('plan with no credit → no gotcha regardless of usage', () => {
    const gotchas = extractUsageSpecificGotchas(cleanPlan, 980)
    expect(gotchas).toHaveLength(0)
  })
})
