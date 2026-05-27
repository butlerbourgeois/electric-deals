/**
 * Shared normalization utilities for electricity plan ingestion scripts.
 *
 * These are pure functions with no side effects — easy to test and reuse
 * across multiple data source adapters (ComparePower, PTC, etc.).
 */

export type PlanType = 'fixed' | 'variable' | 'indexed' | 'tou'

/**
 * Maps a PTC numeric plan type ID to our canonical PlanType.
 * PTC IDs: 1=fixed, 2=variable, 3=indexed, 4=tou
 */
export function planTypeFromId(id: number): PlanType {
  switch (id) {
    case 1: return 'fixed'
    case 2: return 'variable'
    case 3: return 'indexed'
    case 4: return 'tou'
    default: return 'fixed'
  }
}

/**
 * Infers plan type from a free-form string label (e.g. product family name).
 */
export function planTypeFromString(s: string): PlanType {
  const lower = (s ?? '').toLowerCase()
  if (lower.includes('variable') || lower.includes('flex')) return 'variable'
  if (lower.includes('index')) return 'indexed'
  if (lower.includes('time') || lower.includes('tou')) return 'tou'
  return 'fixed'
}

/**
 * Infers plan type from ComparePower product fields.
 *
 * ComparePower does not expose a direct plan_type field — we derive it:
 *   - is_time_of_use flag → 'tou'
 *   - term == 1 month → 'variable' (month-to-month = no price lock = variable)
 *   - everything else  → 'fixed'
 *
 * 'indexed' plans (ERCOT real-time price indexed) are rare on ComparePower
 * and would need to be identified by name pattern — skipped for now.
 */
export function planTypeFromCpProduct(product: {
  is_time_of_use?: boolean
  term?: number
  name?: string
  family?: string
}): PlanType {
  if (product.is_time_of_use) return 'tou'
  if ((product.term ?? 0) <= 1) return 'variable'

  const nameHint = ((product.name ?? '') + (product.family ?? '')).toLowerCase()
  if (nameHint.includes('index') || nameHint.includes('real-time') || nameHint.includes('realtime')) {
    return 'indexed'
  }
  return 'fixed'
}

/**
 * Strips non-numeric characters and parses a fee value.
 * Handles both numeric and string inputs (e.g. "$150", "150.00", 150).
 */
export function parseCancellationFee(raw: string | number | null | undefined): number {
  if (raw == null) return 0
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw
  const match = String(raw).replace(/[^0-9.]/g, '')
  return match ? parseFloat(match) : 0
}

/**
 * Normalizes renewable energy percentage to an integer 0–100.
 * Handles both 0-1 fractional and 0-100 integer representations.
 */
export function parseRenewablePercent(raw: string | number | null | undefined): number {
  if (raw == null) return 0
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
  if (isNaN(n)) return 0
  // ComparePower already uses 0-100; PTC uses 0-100 too.
  // Guard against fractional representation just in case.
  if (n > 0 && n <= 1) return Math.round(n * 100)
  return Math.min(100, Math.max(0, Math.round(n)))
}

/**
 * Returns the URL string if it is a valid absolute URL, otherwise null.
 * Prevents storing malformed relative paths as document links.
 */
export function cleanUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  try {
    new URL(url)
    return url
  } catch {
    return null
  }
}
