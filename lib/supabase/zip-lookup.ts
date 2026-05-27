import { TduTerritory } from '@/types/database'

// Static fallback map for dev/test when DB isn't connected yet
const STATIC_ZIP_MAP: Record<string, { tdu: TduTerritory; city: string }> = {
  // Oncor
  '75001': { tdu: 'oncor', city: 'Addison' },
  '75201': { tdu: 'oncor', city: 'Dallas' },
  '76101': { tdu: 'oncor', city: 'Fort Worth' },
  // CenterPoint
  '77001': { tdu: 'centerpoint', city: 'Houston' },
  '77002': { tdu: 'centerpoint', city: 'Houston' },
  '77450': { tdu: 'centerpoint', city: 'Katy' },
  // AEP Central
  '78401': { tdu: 'aep_central', city: 'Corpus Christi' },
  '76901': { tdu: 'aep_central', city: 'San Angelo' },
  // AEP North
  '79601': { tdu: 'aep_north', city: 'Abilene' },
  '76301': { tdu: 'aep_north', city: 'Wichita Falls' },
  // TNMP
  '75067': { tdu: 'tnmp', city: 'Lewisville' },
  '77510': { tdu: 'tnmp', city: 'Santa Fe' },
  // Non-deregulated
  '78701': { tdu: 'NON_DEREGULATED', city: 'Austin' },
  '78201': { tdu: 'NON_DEREGULATED', city: 'San Antonio' },
}

export interface ZipLookupResult {
  zip: string
  tdu: TduTerritory
  city: string
  isDeregulated: boolean
}

export function lookupZipStatic(zip: string): ZipLookupResult | null {
  const entry = STATIC_ZIP_MAP[zip]
  if (!entry) return null
  return {
    zip,
    tdu: entry.tdu,
    city: entry.city,
    isDeregulated: entry.tdu !== 'NON_DEREGULATED',
  }
}

