/**
 * ============================================================
 * Electric Deals — ComparePower Plan Ingestion Script
 * ============================================================
 *
 * Data source: ComparePower Pricing API (Nuxt SPA backend)
 * Endpoint:    https://pricing.api.comparepower.com/api/plans
 * Method:      GET
 * Auth:        None — public, but requires Origin header matching
 *              plans.comparepower.com to receive JSON responses.
 *
 * Discovery:   The api.comparepower.com domain (referenced in older docs)
 * notes        is dead (404). The live SPA at plans.comparepower.com
 *              exposes its real backend URLs via window.__NUXT__.config.
 *              Two relevant bases:
 *                pricing.api.comparepower.com  — plan data (used here)
 *                ercot.api.comparepower.com    — ERCOT utility metadata
 *
 *              PowerToChoose.org returns HTML for all headless requests
 *              (session-gated). The PTC CSV export endpoint redirects to
 *              404. All checked comparison-site APIs return HTML SPA
 *              shells from this network. ComparePower is the only source
 *              that returned clean JSON.
 *
 * TDU → DUNS mapping:
 *   oncor       → 1039940674000
 *   centerpoint → 957877905
 *   aep_central → 007924772
 *   aep_north   → 007923311
 *   tnmp        → 007929441
 *
 * Field mapping (ComparePower → our schema):
 *   plan._id                       → external_id  (MongoDB ObjectId)
 *   plan.product.brand.name        → provider name
 *   plan.product.name              → plan name
 *   plan.product.term              → term_months
 *   plan.product.percent_green     → renewable_percent (0-100)
 *   plan.product.early_termination_fee → cancellation_fee
 *   plan.product.is_time_of_use    → plan_type='tou'
 *   plan.product.term == 1         → plan_type='variable'
 *   plan.expected_prices[500]      → rate_500_kwh  ($/kWh, multiply by 100 for cents)
 *   plan.expected_prices[1000]     → rate_1000_kwh
 *   plan.expected_prices[2000]     → rate_2000_kwh
 *   plan.components[tdsp_charge=true, !multiplicative] → tdu_monthly_charge
 *   plan.components[tdsp_charge=true, multiplicative]  → tdu_charges_per_kwh
 *   plan.components[!tdsp_charge, !multiplicative, amount>0] → base_monthly_charge
 *   plan.components[!tdsp_charge, multiplicative]     → energy_charge_per_kwh
 *   plan.components[amount < 0, !multiplicative]      → bill credit (amount, min=threshold)
 *   plan.document_links[type=efl]  → efl_url
 *   plan.document_links[type=tos]  → tos_url
 *   plan.document_links[type=yraac|yrac] → yrac_url
 *
 * Rate policy:  1 request per TDU, ~1s delay between requests
 * User-Agent:   electric-deals-bot/1.0 (contact: bourgeoisbh@gmail.com)
 * ============================================================
 */

import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { upsertPlansForTdu, deactivateStalePlans, PlanEntry, PlanRecord } from '../lib/ingest/upsert'
import { planTypeFromCpProduct, parseCancellationFee, parseRenewablePercent, cleanUrl } from '../lib/ingest/normalize'

// Load .env.local (Next.js convention for local secrets — not committed to git)
loadEnv({ path: '.env.local' })

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const SOURCE = 'comparepower'

const CP_BASE_URL = 'https://pricing.api.comparepower.com'

// All five ERCOT TDU service territories with their DUNS identifiers.
// DUNS (Data Universal Numbering System) is the stable ID used by ComparePower
// to scope plan availability to a specific distribution utility.
const TDU_DUNS: Record<string, string> = {
  oncor:       '1039940674000',
  centerpoint: '957877905',
  aep_central: '007924772',
  aep_north:   '007923311',
  tnmp:        '007929441',
}

// ─── ComparePower API types (raw response shape) ──────────────────────────────

interface CpComponent {
  amount: number
  min?: number
  max?: number
  multiplicative: boolean
  tdsp_charge?: boolean
  compound?: boolean
  percentage?: number
}

interface CpDocumentLink {
  type: string
  link?: string
  snapshot_url?: string
}

interface CpExpectedPrice {
  usage: number
  price: number  // $/kWh
}

interface CpProduct {
  _id: string
  brand: { name: string; puct_number?: string }
  name: string
  display_name?: string
  term: number           // months (1 = month-to-month / variable)
  family?: string
  percent_green: number  // 0-100
  headline?: string
  early_termination_fee?: number
  description?: string
  is_pre_pay?: boolean
  is_time_of_use?: boolean
  promo_code?: string
  banner_text?: string
  features?: string[]
}

interface CpPlan {
  _id: string
  product: CpProduct
  tdsp: { _id: string; name: string; duns_number: string }
  components: CpComponent[]
  document_links: CpDocumentLink[]
  expected_prices: CpExpectedPrice[]
  display_pricing_500?: unknown
  display_pricing_1000?: unknown
  display_pricing_2000?: unknown
  total_cost?: number | null
  low?: number | null
  high?: number | null
  average_cost_per_month?: number | null
  average_cost_per_kWh?: number | null
  average_cents_per_kWh?: number | null
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchCpPlans(tdu: string, duns: string): Promise<CpPlan[]> {
  const url = `${CP_BASE_URL}/api/plans?tdsp_duns=${duns}&current=true`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept':          'application/json, */*',
        'User-Agent':      'electric-deals-bot/1.0 (contact: bourgeoisbh@gmail.com)',
        'Origin':          'https://plans.comparepower.com',
        'Referer':         'https://plans.comparepower.com/',
      },
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      console.warn(`  [${tdu}] ComparePower API returned ${res.status}`)
      return []
    }

    const data = await res.json()

    if (!Array.isArray(data)) {
      console.warn(`  [${tdu}] Unexpected response shape:`, JSON.stringify(data).slice(0, 150))
      return []
    }

    return data as CpPlan[]
  } catch (err) {
    const e = err as Error
    if (e.name === 'AbortError' || e.message.includes('aborted')) {
      console.warn(`  [${tdu}] Request timed out`)
    } else {
      console.warn(`  [${tdu}] Fetch error:`, e.message)
    }
    return []
  }
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Extracts pricing data from the `expected_prices` array.
 * Prices from the API are already in $/kWh (e.g. 0.159 = 15.9 cents/kWh).
 * We store them as-is ($/kWh) matching the plan table schema.
 */
function extractRates(prices: CpExpectedPrice[]): {
  rate_500_kwh:  number | null
  rate_1000_kwh: number | null
  rate_2000_kwh: number | null
} {
  const byUsage = new Map(prices.map(p => [p.usage, p.price]))
  return {
    rate_500_kwh:  byUsage.get(500)  ?? null,
    rate_1000_kwh: byUsage.get(1000) ?? null,
    rate_2000_kwh: byUsage.get(2000) ?? null,
  }
}

/**
 * Extracts component-level charge breakdowns.
 *
 * ComparePower models pricing as a list of charge components:
 *   - tdsp_charge=true, !multiplicative  → TDU flat monthly charge ($/mo)
 *   - tdsp_charge=true, multiplicative   → TDU per-kWh charge ($/kWh)
 *   - !tdsp_charge, !multiplicative, >0  → REP base monthly charge ($/mo)
 *   - !tdsp_charge, multiplicative       → REP energy charge ($/kWh)
 *   - amount < 0, !multiplicative        → bill credit (negative dollar amount)
 *
 * When multiple components of the same category exist (rare), we sum them.
 */
function extractComponents(components: CpComponent[]): {
  base_monthly_charge:    number
  energy_charge_per_kwh:  number | null
  tdu_charges_per_kwh:    number | null
  tdu_monthly_charge:     number | null
  bill_credit_amount:     number | null
  bill_credit_threshold:  number | null
} {
  let tduMonthly    = 0
  let tduPerKwh     = 0
  let baseMonthly   = 0
  let energyPerKwh  = 0
  let billCredit    = 0
  let billThreshold: number | null = null

  for (const c of components) {
    const isTdu   = !!c.tdsp_charge
    const isFlat  = !c.multiplicative
    const amount  = c.amount ?? 0

    if (amount < 0 && isFlat) {
      // Bill credit — amount is negative (e.g. -75 means $75 credit)
      billCredit    += amount
      // 'min' on a credit component is the usage threshold that triggers it
      billThreshold  = c.min ?? null
    } else if (isTdu && isFlat) {
      tduMonthly += amount
    } else if (isTdu && !isFlat) {
      tduPerKwh += amount
    } else if (!isTdu && isFlat && amount > 0) {
      baseMonthly += amount
    } else if (!isTdu && !isFlat && amount > 0) {
      energyPerKwh += amount
    }
  }

  return {
    base_monthly_charge:   baseMonthly,
    energy_charge_per_kwh: energyPerKwh > 0 ? energyPerKwh : null,
    tdu_charges_per_kwh:   tduPerKwh   > 0 ? tduPerKwh   : null,
    tdu_monthly_charge:    tduMonthly  > 0 ? tduMonthly  : null,
    // Store bill credit as a positive number (absolute value); direction is
    // implied by the column name. Null if no credit on this plan.
    bill_credit_amount:    billCredit  < 0 ? Math.abs(billCredit) : null,
    bill_credit_threshold: billCredit  < 0 ? billThreshold        : null,
  }
}

/**
 * Extracts EFL/TOS/YRAC document URLs from the document_links array.
 * ComparePower provides both a live vendor URL and a snapshot PDF URL.
 * We prefer the live vendor URL (more likely to be current).
 */
function extractDocUrls(links: CpDocumentLink[]): {
  efl_url:  string | null
  tos_url:  string | null
  yrac_url: string | null
} {
  const find = (typeFragments: string[]) => {
    const match = links.find(l =>
      typeFragments.some(f => l.type?.toLowerCase().includes(f))
    )
    return cleanUrl(match?.link ?? match?.snapshot_url ?? null)
  }

  return {
    efl_url:  find(['efl']),
    tos_url:  find(['tos']),
    yrac_url: find(['yraac', 'yrac']),
  }
}

/**
 * Converts a raw ComparePower plan object into our canonical PlanRecord.
 */
function normalizeCpPlan(raw: CpPlan, tdu: string): PlanRecord {
  const product = raw.product

  const rates    = extractRates(raw.expected_prices ?? [])
  const comps    = extractComponents(raw.components ?? [])
  const docs     = extractDocUrls(raw.document_links ?? [])
  const planType = planTypeFromCpProduct({
    is_time_of_use: product.is_time_of_use,
    term:           product.term,
    name:           product.name,
    family:         product.family,
  })

  return {
    external_id:            raw._id,
    source:                 SOURCE,
    name:                   (product.display_name ?? product.name)?.trim() ?? 'Unknown Plan',
    plan_type:              planType,
    term_months:            product.term ?? 12,
    tdu_territory:          tdu,
    rate_500_kwh:           rates.rate_500_kwh,
    rate_1000_kwh:          rates.rate_1000_kwh,
    rate_2000_kwh:          rates.rate_2000_kwh,
    base_monthly_charge:    comps.base_monthly_charge,
    energy_charge_per_kwh:  comps.energy_charge_per_kwh,
    tdu_charges_per_kwh:    comps.tdu_charges_per_kwh,
    tdu_monthly_charge:     comps.tdu_monthly_charge,
    bill_credit_amount:     comps.bill_credit_amount,
    bill_credit_threshold:  comps.bill_credit_threshold,
    renewable_percent:      parseRenewablePercent(product.percent_green),
    cancellation_fee:       parseCancellationFee(product.early_termination_fee),
    efl_url:                docs.efl_url,
    tos_url:                docs.tos_url,
    yrac_url:               docs.yrac_url,
    is_active:              true,
  }
}

// ─── Mock fallback (mirrors ingest-ptc.ts so dev always has data) ─────────────

function generateMockPlans(tdu: string): PlanEntry[] {
  const providers = [
    'Gexa Energy', 'Rhythm Energy', 'TXU Energy', 'Constellation',
    'Direct Energy', 'Reliant', 'Frontier Utilities', 'Green Mountain Energy',
  ]
  const planTypes: Array<'fixed' | 'variable'> = ['fixed', 'fixed', 'fixed', 'variable']
  const terms = [12, 12, 24, 36, 6]

  return providers.flatMap((providerName, pi) =>
    Array.from({ length: 2 }, (_, i): PlanEntry => {
      const baseRate = 10 + ((pi * 2 + i) % 10) * 0.5
      const term     = terms[(pi + i) % terms.length]
      const planType = planTypes[(pi + i) % planTypes.length]
      const hasBillCredit = (pi + i) % 3 === 0

      return {
        provider: providerName,
        plan: {
          external_id:            `mock-${tdu}-${pi}-${i}`,
          source:                 'mock',
          name:                   `${providerName} ${term}-Month ${planType === 'fixed' ? 'Fixed' : 'Variable'} ${i === 0 ? 'Value' : 'Plus'}`,
          plan_type:              planType,
          term_months:            term,
          tdu_territory:          tdu,
          rate_500_kwh:           parseFloat(((baseRate + 2) / 100).toFixed(5)),
          rate_1000_kwh:          parseFloat((baseRate / 100).toFixed(5)),
          rate_2000_kwh:          parseFloat(((baseRate - 0.5) / 100).toFixed(5)),
          base_monthly_charge:    (pi + i) % 2 === 0 ? 4.95 : 9.95,
          energy_charge_per_kwh:  null,
          tdu_charges_per_kwh:    null,
          tdu_monthly_charge:     null,
          bill_credit_amount:     hasBillCredit ? 100 : null,
          bill_credit_threshold:  hasBillCredit ? 1000 : null,
          renewable_percent:      (pi * 13 + i * 7) % 101,
          cancellation_fee:       term > 12 ? 200 : 150,
          efl_url:                'https://www.powertochoose.org',
          tos_url:                null,
          yrac_url:               null,
          is_active:              true,
        },
      }
    })
  )
}

// ─── CLI flags ────────────────────────────────────────────────────────────────

function isDryRun(): boolean {
  return process.argv.includes('--dry-run') || process.argv.includes('-- --dry-run')
}

// ─── Summary table ────────────────────────────────────────────────────────────

function printSummary(
  rows: Array<{ tdu: string; plans: number; status: string }>,
  totalProviders: number,
  usedMockData: boolean,
  hasSupabase: boolean
) {
  const colW = [14, 8, 16]
  const divider = '+' + colW.map(w => '-'.repeat(w + 2)).join('+') + '+'
  const row = (cells: string[]) =>
    '| ' + cells.map((c, i) => c.padEnd(colW[i])).join(' | ') + ' |'

  console.log('\n' + divider)
  console.log(row(['TDU', 'Plans', 'Status']))
  console.log(divider)
  for (const r of rows) {
    console.log(row([r.tdu, String(r.plans), r.status]))
  }
  console.log(divider)
  console.log(`  Total plans  : ${rows.reduce((s, r) => s + r.plans, 0)}`)
  console.log(`  Unique REPs  : ${totalProviders}`)
  if (usedMockData) {
    console.log('  WARNING: Mock data used — ComparePower API returned no results')
  }
  if (!hasSupabase) {
    console.log('  Mode: DRY RUN (Supabase not configured)')
    console.log('  Add real credentials to .env.local to write to DB.')
  }
  console.log(divider)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Electric Deals — ComparePower plan ingestion')
  console.log(`Source : ${CP_BASE_URL}/api/plans?tdsp_duns=<DUNS>&current=true`)
  console.log(`Dry run: ${isDryRun() || !isSupabaseConfigured() ? 'yes' : 'no'}\n`)

  const dryRun   = isDryRun() || !isSupabaseConfigured()
  const supabase = dryRun ? null : createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

  if (!isSupabaseConfigured()) {
    console.log('WARNING: Supabase not configured (placeholder env vars detected).')
    console.log('  Running in DRY RUN mode — fetching real data but not writing to DB.\n')
  }

  const summaryRows: Array<{ tdu: string; plans: number; status: string }> = []
  const totalProviders = new Set<string>()
  let usedMockData = false
  let fatalError   = false

  for (const [tdu, duns] of Object.entries(TDU_DUNS)) {
    console.log(`\nFetching ${tdu} (DUNS ${duns})...`)

    const rawPlans = await fetchCpPlans(tdu, duns)

    let planEntries: PlanEntry[]

    if (rawPlans.length === 0) {
      console.log(`  WARNING: No plans from ComparePower for ${tdu}. Falling back to mock data.`)
      planEntries  = generateMockPlans(tdu)
      usedMockData = true
    } else {
      console.log(`  Got ${rawPlans.length} plans from ComparePower`)
      planEntries = rawPlans.map(raw => ({
        provider: raw.product.brand.name?.trim() ?? 'Unknown Provider',
        plan:     normalizeCpPlan(raw, tdu),
      }))
    }

    planEntries.forEach(e => totalProviders.add(e.provider))

    if (dryRun) {
      // Dry run: log a few samples so the developer can verify the shape
      planEntries.slice(0, 3).forEach(e => {
        const p = e.plan
        const rate = p.rate_1000_kwh != null
          ? `${(p.rate_1000_kwh * 100).toFixed(1)}¢/kWh`
          : 'rate unknown'
        console.log(
          `  Sample [${p.plan_type}] ${e.provider} — "${p.name}" @ ${rate}, ${p.term_months}mo`
        )
      })
      if (planEntries.length > 3) {
        console.log(`  ... and ${planEntries.length - 3} more`)
      }
      summaryRows.push({ tdu, plans: planEntries.length, status: 'dry-run' })
      // 1-second courtesy delay even in dry-run (keeps same behavior as live)
      await sleep(1000)
      continue
    }

    // Live write path
    try {
      const result = await upsertPlansForTdu(supabase!, tdu, planEntries)
      console.log(`  Upserted ${result.upsertedCount} plans (${result.errorCount} errors)`)
      summaryRows.push({
        tdu,
        plans:  result.upsertedCount,
        status: result.errorCount === 0 ? 'ok' : `${result.errorCount} errors`,
      })
    } catch (err) {
      // Per-TDU failure is non-fatal — log and continue
      console.error(`  [${tdu}] Unexpected error:`, (err as Error).message)
      summaryRows.push({ tdu, plans: 0, status: 'ERROR' })
      fatalError = true
    }

    await sleep(1000)
  }

  // Soft-delete stale plans from the live source (not mock — mock has no TTL)
  if (!dryRun) {
    await deactivateStalePlans(supabase!, SOURCE)
  }

  printSummary(summaryRows, totalProviders.size, usedMockData, !dryRun)

  if (fatalError) process.exit(1)
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function isSupabaseConfigured(): boolean {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return false

  // The URL must be a project API URL (*.supabase.co or self-hosted),
  // not the dashboard URL (supabase.com/dashboard/...) or a placeholder.
  const urlLooksLikeApi =
    SUPABASE_URL.includes('.supabase.co') ||
    // Allow self-hosted instances on non-supabase.com domains
    (SUPABASE_URL.startsWith('http') && !SUPABASE_URL.includes('supabase.com/dashboard'))

  const keyLooksReal =
    !SUPABASE_SERVICE_KEY.includes('your-service') &&
    !SUPABASE_SERVICE_KEY.includes('placeholder') &&
    SUPABASE_SERVICE_KEY.length > 20  // real JWTs are much longer

  return urlLooksLikeApi && keyLooksReal
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Entry point ──────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
