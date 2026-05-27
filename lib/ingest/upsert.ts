/**
 * Shared Supabase upsert helpers for plan ingestion scripts.
 *
 * Extracted from the per-source scripts so that ComparePower, PTC, and any
 * future adapter all write to the DB through the same code path.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlanRecord {
  external_id: string
  source: string
  name: string
  plan_type: 'fixed' | 'variable' | 'indexed' | 'tou'
  term_months: number
  tdu_territory: string
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
}

export interface PlanEntry {
  provider: string
  plan: PlanRecord
}

export interface UpsertResult {
  upsertedCount: number
  errorCount: number
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────

/**
 * Upserts providers and their plans for a single TDU territory.
 *
 * Two-phase write:
 *   1. Upsert providers (conflict on `name`) → get back IDs
 *   2. Upsert plans    (conflict on `external_id, source`) with provider_id FK
 *
 * Any plan whose provider failed to upsert is silently skipped (counted in
 * errorCount). The caller should log the TDU-level result.
 */
export async function upsertPlansForTdu(
  supabase: SupabaseClient,
  tdu: string,
  planEntries: PlanEntry[]
): Promise<UpsertResult> {
  if (planEntries.length === 0) return { upsertedCount: 0, errorCount: 0 }

  // ── Phase 1: upsert providers ──────────────────────────────────────────────
  const providerNames = [...new Set(planEntries.map(e => e.provider))]

  const { data: upsertedProviders, error: providerError } = await supabase
    .from('provider')
    .upsert(
      providerNames.map(name => ({ name })),
      { onConflict: 'name', ignoreDuplicates: false }
    )
    .select('id, name')

  if (providerError) {
    console.error(`  [${tdu}] Provider upsert error:`, providerError.message)
    return { upsertedCount: 0, errorCount: planEntries.length }
  }

  const providerMap = new Map<string, string>(
    (upsertedProviders ?? []).map((p: { id: string; name: string }) => [p.name, p.id])
  )

  // ── Phase 2: upsert plans ──────────────────────────────────────────────────
  const plansToUpsert = planEntries
    .filter(e => providerMap.has(e.provider))
    .map(e => ({
      ...e.plan,
      provider_id: providerMap.get(e.provider)!,
      last_seen_at: new Date().toISOString(),
    }))

  const skippedCount = planEntries.length - plansToUpsert.length

  const { error: planError } = await supabase
    .from('plan')
    .upsert(plansToUpsert, {
      onConflict: 'external_id,source',
      ignoreDuplicates: false,
    })

  if (planError) {
    console.error(`  [${tdu}] Plan upsert error:`, planError.message)
    return { upsertedCount: 0, errorCount: plansToUpsert.length + skippedCount }
  }

  return {
    upsertedCount: plansToUpsert.length,
    errorCount: skippedCount,
  }
}

/**
 * Soft-deletes plans from a given source that have not been refreshed within
 * the last 25 hours (1-hour buffer around a 24h cron schedule).
 *
 * Only affects `is_active = true` rows — already-inactive plans are untouched
 * to avoid spurious UPDATE churn.
 */
export async function deactivateStalePlans(
  supabase: SupabaseClient,
  source: string
): Promise<void> {
  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('plan')
    .update({ is_active: false })
    .lt('last_seen_at', cutoff)
    .eq('is_active', true)
    .eq('source', source)

  if (error) {
    console.error(`Stale plan deactivation error (source=${source}):`, error.message)
  } else {
    console.log(`✓ Stale ${source} plans marked inactive (cutoff: ${cutoff})`)
  }
}
