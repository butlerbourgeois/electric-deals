import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load .env.local (Next.js convention for local secrets — not committed to git)
loadEnv({ path: '.env.local' })

// ─── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TDU_REPRESENTATIVE_ZIPS: Record<string, string> = {
  oncor:       '75201',
  centerpoint: '77002',
  aep_central: '78401',
  aep_north:   '79601',
  tnmp:        '75067',
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PTCPlan {
  IDPlan: number
  CompanyName: string
  PlanName: string
  PlanTypeID: number    // 1=fixed, 2=variable, 3=indexed, 4=tou
  Price500: number      // cents/kWh at 500
  Price1000: number     // cents/kWh at 1000
  Price2000: number     // cents/kWh at 2000
  TermValue: number     // months
  RenewableEnergyID: number  // 0-100
  CancellationFee: string | number
  NewCustomerURL: string
  PlanDocuments?: Array<{ DocumentType?: string; URL?: string }>
  Fees?: Array<{ FeeType?: string; FeeAmount?: number }>
  WirelineName?: string
}

interface NormalizedPlan {
  external_id: string
  source: string
  name: string
  plan_type: 'fixed' | 'variable' | 'indexed' | 'tou'
  term_months: number
  tdu_territory: string
  rate_500_kwh: number
  rate_1000_kwh: number
  rate_2000_kwh: number | null
  base_monthly_charge: number
  energy_charge_per_kwh: null
  tdu_charges_per_kwh: null
  tdu_monthly_charge: null
  bill_credit_amount: number | null
  bill_credit_threshold: number | null
  renewable_percent: number
  cancellation_fee: number
  efl_url: string | null
  tos_url: string | null
  yrac_url: string | null
  is_active: boolean
}

// ─── PTC Fetch ───────────────────────────────────────────────────────────────

async function fetchPTCPlans(zip: string): Promise<PTCPlan[]> {
  const url = 'https://www.powertochoose.org/en-us/Plan/Results'

  const body = {
    zip_code: zip,
    renewable: '',
    typeFilter: '',
    minimumUsage: '',
    maximumUsage: '',
    term: '',
    language: 'en',
    customPlanName: '',
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; electricity-comparison-bot/1.0)',
        'Referer': 'https://www.powertochoose.org/',
        'Origin': 'https://www.powertochoose.org',
      },
      body: JSON.stringify(body),
      // Abort if the API hangs — don't block the whole run
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      console.warn(`  PTC API returned ${res.status} for ZIP ${zip}`)
      return []
    }

    const data = await res.json()

    // PTC API returns either an array directly or { plans: [...] } or { data: [...] }
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.plans)) return data.plans
    if (Array.isArray(data?.data)) return data.data
    if (Array.isArray(data?.Results)) return data.Results

    console.warn(`  Unexpected PTC response shape for ZIP ${zip}:`, JSON.stringify(data).slice(0, 200))
    return []
  } catch (err) {
    const msg = (err as Error).message
    // AbortError means the request timed out — log cleanly
    if ((err as Error).name === 'AbortError' || msg.includes('aborted')) {
      console.warn(`  PTC request timed out for ZIP ${zip}`)
    } else {
      console.warn(`  Failed to fetch PTC for ZIP ${zip}:`, msg)
    }
    return []
  }
}

// ─── Normalization ────────────────────────────────────────────────────────────

function planTypeFromId(id: number): 'fixed' | 'variable' | 'indexed' | 'tou' {
  switch (id) {
    case 1: return 'fixed'
    case 2: return 'variable'
    case 3: return 'indexed'
    case 4: return 'tou'
    default: return 'fixed'
  }
}

function extractEflUrl(plan: PTCPlan): string | null {
  const docs = plan.PlanDocuments ?? []
  const efl = docs.find(
    d =>
      d.DocumentType?.toLowerCase().includes('efl') ||
      d.DocumentType?.toLowerCase().includes('electricity facts')
  )
  return efl?.URL ?? plan.NewCustomerURL ?? null
}

function parseCancellationFee(raw: string | number): number {
  if (typeof raw === 'number') return raw
  const stripped = String(raw).replace(/[^0-9.]/g, '')
  return stripped ? parseFloat(stripped) : 0
}

function normalizePlan(ptc: PTCPlan, tdu: string): NormalizedPlan {
  return {
    external_id: String(ptc.IDPlan),
    source: 'powertochoose',
    name: ptc.PlanName?.trim() ?? 'Unknown Plan',
    plan_type: planTypeFromId(ptc.PlanTypeID),
    term_months: ptc.TermValue ?? 12,
    tdu_territory: tdu,
    rate_500_kwh: ptc.Price500 ?? 0,
    rate_1000_kwh: ptc.Price1000 ?? 0,
    rate_2000_kwh: ptc.Price2000 ?? null,
    // Component-level breakdown (base charge, energy rate, TDU passthrough)
    // is not available from the PTC aggregate rates endpoint.
    // Parsing these requires fetching and parsing each plan's EFL PDF — tracked as Phase 2.
    base_monthly_charge: 0,
    energy_charge_per_kwh: null,
    tdu_charges_per_kwh: null,
    tdu_monthly_charge: null,
    bill_credit_amount: null,
    bill_credit_threshold: null,
    renewable_percent: ptc.RenewableEnergyID ?? 0,
    cancellation_fee: parseCancellationFee(ptc.CancellationFee),
    efl_url: extractEflUrl(ptc),
    tos_url: null,
    yrac_url: null,
    is_active: true,
  }
}

// ─── Mock Data (fallback when PTC is unavailable) ────────────────────────────

function generateMockPlans(tdu: string): Array<{ provider: string; plan: NormalizedPlan }> {
  const providers = [
    'Gexa Energy',
    'Rhythm Energy',
    'TXU Energy',
    'Constellation',
    'Direct Energy',
    'Reliant',
    'Frontier Utilities',
    'Green Mountain Energy',
  ]
  const planTypes: Array<'fixed' | 'variable'> = ['fixed', 'fixed', 'fixed', 'variable']
  const terms = [12, 12, 24, 36, 6]

  return providers.flatMap((providerName, pi) => {
    return Array.from({ length: 2 }, (_, i) => {
      // Use deterministic-ish values based on index so repeated runs produce stable mock data
      const baseRate = 10 + ((pi * 2 + i) % 10) * 0.5  // 10–14.5 cents/kWh
      const term = terms[(pi + i) % terms.length]
      const planType = planTypes[(pi + i) % planTypes.length]
      const hasBillCredit = (pi + i) % 3 === 0

      return {
        provider: providerName,
        plan: {
          external_id: `mock-${tdu}-${pi}-${i}`,
          source: 'mock',
          name: `${providerName} ${term}-Month ${planType === 'fixed' ? 'Fixed' : 'Variable'} ${i === 0 ? 'Value' : 'Plus'}`,
          plan_type: planType,
          term_months: term,
          tdu_territory: tdu,
          rate_500_kwh: parseFloat((baseRate + 2).toFixed(2)),
          rate_1000_kwh: parseFloat(baseRate.toFixed(2)),
          rate_2000_kwh: parseFloat((baseRate - 0.5).toFixed(2)),
          base_monthly_charge: (pi + i) % 2 === 0 ? 4.95 : 9.95,
          energy_charge_per_kwh: null,
          tdu_charges_per_kwh: null,
          tdu_monthly_charge: null,
          bill_credit_amount: hasBillCredit ? 100 : null,
          bill_credit_threshold: hasBillCredit ? 1000 : null,
          renewable_percent: (pi * 13 + i * 7) % 101,  // deterministic 0-100
          cancellation_fee: term > 12 ? 200 : 150,
          efl_url: 'https://www.powertochoose.org',
          tos_url: null,
          yrac_url: null,
          is_active: true,
        } as NormalizedPlan,
      }
    })
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Electric Deals -- PowerToChoose ingestion\n')

  // Detect whether Supabase has been configured with real credentials
  const hasSupabase =
    SUPABASE_URL &&
    !SUPABASE_URL.includes('your-project') &&
    !SUPABASE_URL.includes('placeholder') &&
    SUPABASE_SERVICE_KEY &&
    !SUPABASE_SERVICE_KEY.includes('your-service') &&
    !SUPABASE_SERVICE_KEY.includes('placeholder')

  if (!hasSupabase) {
    console.log('WARNING: Supabase not configured (placeholder env vars detected).')
    console.log('  Running in DRY RUN mode -- will fetch/generate plans and log them, but not write to DB.\n')
    console.log('  To enable DB writes: fill in .env.local with real Supabase credentials.\n')
  }

  const supabase = hasSupabase
    ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
    : null

  let totalPlansProcessed = 0
  const totalProviders = new Set<string>()
  let usedMockData = false

  for (const [tdu, zip] of Object.entries(TDU_REPRESENTATIVE_ZIPS)) {
    console.log(`\nFetching plans for ${tdu} (ZIP ${zip})...`)

    const ptcPlans = await fetchPTCPlans(zip)
    let planEntries: Array<{ provider: string; plan: NormalizedPlan }>

    if (ptcPlans.length === 0) {
      console.log(`  WARNING: No plans from PTC. Using mock data for ${tdu}.`)
      planEntries = generateMockPlans(tdu)
      usedMockData = true
    } else {
      console.log(`  Got ${ptcPlans.length} plans from PowerToChoose`)
      planEntries = ptcPlans.map(p => ({
        provider: p.CompanyName?.trim() ?? 'Unknown Provider',
        plan: normalizePlan(p, tdu),
      }))
    }

    // Collect unique provider names for summary
    planEntries.forEach(e => totalProviders.add(e.provider))

    if (!supabase) {
      // Dry run: log samples so the operator can verify shape
      planEntries.slice(0, 3).forEach(e => {
        console.log(
          `  Sample: [${e.plan.plan_type}] ${e.provider} -- "${e.plan.name}" @ ${e.plan.rate_1000_kwh}c/kWh, ${e.plan.term_months}mo`
        )
      })
      if (planEntries.length > 3) {
        console.log(`  ... and ${planEntries.length - 3} more`)
      }
      totalPlansProcessed += planEntries.length
      continue
    }

    // ── Upsert providers ────────────────────────────────────────────────────
    const providerNames = [...new Set(planEntries.map(e => e.provider))]
    const { data: upsertedProviders, error: providerError } = await supabase
      .from('provider')
      .upsert(
        providerNames.map(name => ({ name })),
        { onConflict: 'name', ignoreDuplicates: false }
      )
      .select('id, name')

    if (providerError) {
      console.error(`  Provider upsert error:`, providerError.message)
      continue
    }

    const providerMap = new Map(upsertedProviders?.map(p => [p.name, p.id]) ?? [])

    // ── Upsert plans ────────────────────────────────────────────────────────
    const plansToUpsert = planEntries
      .filter(e => providerMap.has(e.provider))
      .map(e => ({
        ...e.plan,
        provider_id: providerMap.get(e.provider)!,
        last_seen_at: new Date().toISOString(),
      }))

    const { error: planError } = await supabase
      .from('plan')
      .upsert(plansToUpsert, {
        onConflict: 'external_id,source',
        ignoreDuplicates: false,
      })

    if (planError) {
      console.error(`  Plan upsert error:`, planError.message)
    } else {
      console.log(`  Upserted ${plansToUpsert.length} plans for ${tdu}`)
    }

    totalPlansProcessed += planEntries.length
  }

  // ── Soft-delete stale plans ────────────────────────────────────────────────
  // Any real plan not refreshed within the last 25 hours is considered stale
  // (gives a 1-hour buffer around a 24h cron schedule).
  if (supabase) {
    const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('plan')
      .update({ is_active: false })
      .lt('last_seen_at', cutoff)
      .eq('is_active', true)
      .not('source', 'eq', 'mock')

    if (!error) {
      console.log('\nMarked stale plans as inactive')
    }
  }

  console.log('\n' + '-'.repeat(50))
  console.log('Done!')
  console.log(`  Plans processed : ${totalPlansProcessed}`)
  console.log(`  Unique providers: ${totalProviders.size}`)
  if (usedMockData) {
    console.log(`  WARNING: Mock data was used for some/all territories`)
    console.log(`    (PTC API unavailable -- plans will show as source='mock')`)
  }
  if (!supabase) {
    console.log(`\n  To write to DB: update .env.local with Supabase credentials and re-run.`)
  }
  console.log('-'.repeat(50))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
