/**
 * Server-only ZIP lookup utilities.
 * This file imports next/headers via createClient — do NOT import from client components.
 * Client components should use lookupZipStatic from ./zip-lookup instead.
 */
import { createClient } from '@/lib/supabase/server'
import { TduTerritory } from '@/types/database'
import { lookupZipStatic, ZipLookupResult } from './zip-lookup'

export type { ZipLookupResult }

/**
 * DB-backed ZIP lookup with static fallback.
 * Use this in server components and API routes.
 * The static lookup is used as a fallback on DB error.
 */
export async function lookupZipFromDb(zip: string): Promise<ZipLookupResult | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('zip_tdu')
      .select('zip, tdu_territory, city, county')
      .eq('zip', zip)
      .maybeSingle()

    if (error || !data) return lookupZipStatic(zip)

    return {
      zip: data.zip,
      tdu: data.tdu_territory as TduTerritory,
      city: data.city,
      isDeregulated: data.tdu_territory !== 'NON_DEREGULATED',
    }
  } catch {
    return lookupZipStatic(zip)
  }
}
