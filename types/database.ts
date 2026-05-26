export type TduTerritory = 'oncor' | 'centerpoint' | 'aep_central' | 'aep_north' | 'tnmp' | 'NON_DEREGULATED'
export type PlanType = 'fixed' | 'variable' | 'indexed' | 'tou'

export interface Provider {
  id: string
  name: string
  puct_number: string | null
  logo_url: string | null
  website: string | null
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  provider_id: string
  provider?: Provider
  external_id: string | null
  source: string
  name: string
  plan_type: PlanType
  term_months: number
  tdu_territory: TduTerritory
  rate_500_kwh: number | null
  rate_1000_kwh: number | null
  rate_2000_kwh: number | null
  base_monthly_charge: number
  energy_charge_per_kwh: number | null
  tdu_charges_per_kwh: number | null
  tdu_monthly_charge: number | null
  bill_credit_amount: number | null
  bill_credit_threshold: number | null
  renewable_percent: number
  cancellation_fee: number
  efl_url: string | null
  tos_url: string | null
  yrac_url: string | null
  is_active: boolean
  last_seen_at: string
  created_at: string
  updated_at: string
}

export interface ZipTdu {
  zip: string
  tdu_territory: TduTerritory
  city: string
  county: string
}

export interface UsageProfile {
  id: string
  email: string | null
  session_id: string
  zip: string
  tdu_territory: TduTerritory
  monthly_kwh: number | null
  monthly_bill: number | null
  home_type: 'apartment' | 'small_home' | 'large_home' | null
  preferences: {
    prefer_green?: boolean
    prefer_fixed?: boolean
    max_term?: number
  }
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  usage_profile_id: string
  plan_id: string
  plan?: Plan
  estimated_monthly_bill: number
  estimated_annual_cost: number
  effective_rate_per_kwh: number
  rank: number
  rank_reason: string
  computed_at: string
}

export interface EnrollmentHandoff {
  id: string
  quote_id: string
  usage_profile_id: string
  plan_id: string
  aggregator: string
  handoff_url: string
  sub_id: string
  clicked_at: string
  reconciled_status: 'enrolled' | 'rejected' | 'pending' | null
  commission_amount: number | null
  reconciled_at: string | null
}
