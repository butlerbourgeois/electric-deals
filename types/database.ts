export type TduTerritory = 'oncor' | 'centerpoint' | 'aep_central' | 'aep_north' | 'tnmp' | 'NON_DEREGULATED'
export type PlanType = 'fixed' | 'variable' | 'indexed' | 'tou'

// ─── Gotcha types ─────────────────────────────────────────────────────────────

export type GotchaCode =
  | 'bill_credit_cliff'        // large bill swing when usage dips below credit threshold
  | 'rate_doubles_low_usage'   // rate_500 is 1.5x+ higher than rate_1000
  | 'high_base_charge'         // base monthly charge >= $9.95
  | 'high_etf'                 // early termination fee >= $250 on a 12+ month contract
  | 'teaser_rate_short_term'   // variable plan with <= 3-month term (intro-rate pattern)
  | 'tdu_charge_buried_in_rate'// no per-kWh component breakdown available
  | 'usage_near_cliff'         // computed at compare-time: user's kWh is within 100 of credit threshold

export interface Gotcha {
  code: GotchaCode
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  threshold_kwh?: number   // relevant for cliff/near-cliff gotchas
  swing_dollars?: number   // dollar impact for cliff gotchas
}

export interface ProjectedCostPoint {
  monthly: number
  annual: number
  method: 'components' | 'interpolated' | 'anchor'
}

export interface ProjectedCosts {
  at_500:  ProjectedCostPoint
  at_1000: ProjectedCostPoint
  at_2000: ProjectedCostPoint
}

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
  enrollment_url: string | null
  gotchas: Gotcha[]
  projected_costs: ProjectedCosts | null
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
  // Renewal alert capture (added migration 000014)
  email_captured: boolean
  renewal_alert_id: string | null
}

// ─── Renewal alert types ──────────────────────────────────────────────────────

export type RenewalAlertStatus = 'active' | 'unsubscribed' | 'bounced' | 'completed'
export type EmailSendMilestone = 'welcome' | 'd45' | 'd30' | 'd15'
export type EmailSendStatus = 'pending' | 'sent' | 'failed' | 'bounced' | 'opened' | 'clicked'

export interface RenewalAlert {
  id: string
  email: string
  plan_id: string
  plan?: Plan
  usage_profile_id: string | null
  tdu_territory: TduTerritory
  monthly_kwh: number
  contract_end_date: string   // ISO date string YYYY-MM-DD
  term_months: number
  unsubscribe_token: string
  status: RenewalAlertStatus
  created_at: string
}

export interface EmailSend {
  id: string
  renewal_alert_id: string
  milestone: EmailSendMilestone
  sent_at: string | null
  resend_message_id: string | null
  status: EmailSendStatus
}

// Joined types
export type PlanWithProvider = Plan & { provider: Provider }
export type RenewalAlertWithPlan = RenewalAlert & { plan: PlanWithProvider }

// Insert shapes (omit DB-generated fields)
export type QuoteInsert = Omit<Quote, 'id' | 'computed_at' | 'plan'>
export type UsageProfileInsert = Omit<UsageProfile, 'id' | 'created_at' | 'updated_at'>
export type EnrollmentHandoffInsert = Omit<EnrollmentHandoff, 'id'>
export type RenewalAlertInsert = Omit<RenewalAlert, 'id' | 'unsubscribe_token' | 'status' | 'created_at' | 'plan'>
export type EmailSendInsert = Omit<EmailSend, 'id'>
