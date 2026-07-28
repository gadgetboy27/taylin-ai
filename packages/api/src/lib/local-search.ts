import { supabase } from './supabase.js'

/**
 * Local-first product lookup.
 *
 * Search used to fire every adapter in parallel and hand the combined pile to
 * the ranker. That cost an eBay and a Brave call on every single search, and
 * ranking tokens scaled with a candidate list dominated by external results —
 * which is also why lib/ranking-fairness.ts had to exist at all: local sellers
 * were being crowded out of a pool they were a rounding error in.
 *
 * Widening in rungs instead means external sources are only paid for when the
 * local market genuinely can't answer, and the ranker usually sees a handful of
 * relevant local candidates rather than forty mixed ones.
 *
 * Country is part of every rung. Postcodes are only unique within a country, so
 * comparing them without it would happily call an overseas seller "local".
 */

export type Locality = {
  country: string
  suburb: string | null
  city: string | null
  postcode: string | null
}

export type LocalRung = 'suburb' | 'postcode' | 'city' | 'national'

export type LocalResult = {
  rows: Record<string, unknown>[]
  /** How far the ladder had to widen — for logging and for the UI to explain. */
  rung: LocalRung | null
}

/** Buyer locality, or null when they've never set an address. */
export async function getBuyerLocality(userId: string): Promise<Locality | null> {
  const { data } = await supabase
    .from('users')
    .select('country, suburb, city, postcode')
    .eq('id', userId)
    .maybeSingle()

  if (!data) return null
  return {
    country: data.country ?? 'NZ',
    suburb: data.suburb,
    city: data.city,
    postcode: data.postcode,
  }
}

function baseQuery(orFilter: string, priceMax: number) {
  // Only active sellers are searchable at all — suspended and banned are
  // excluded here, not merely deprioritised at ranking time.
  return supabase
    .from('products')
    .select('*, sellers!inner(trust_tier, business_name, status, country, suburb, city, postcode)')
    .eq('sellers.status', 'active')
    .or(orFilter)
    .eq('stock_available', true)
    .lte('price', priceMax)
    .limit(20)
}

/**
 * Walks suburb → postcode → city → national, stopping as soon as a rung
 * returns at least `enough` products. Returns the widest rung it needed, so
 * callers can decide whether external sources are still worth calling.
 */
export async function findLocalProducts(params: {
  orFilter: string
  priceMax: number
  locality: Locality | null
  enough: number
}): Promise<LocalResult> {
  const { orFilter, priceMax, locality, enough } = params

  // No address on file: there is no "local" to prefer, so answer nationally and
  // let the caller top up from external sources.
  if (!locality) {
    const { data } = await baseQuery(orFilter, priceMax)
    return { rows: data ?? [], rung: data?.length ? 'national' : null }
  }

  const rungs: { rung: LocalRung; apply: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery> }[] = []

  if (locality.suburb) {
    rungs.push({
      rung: 'suburb',
      apply: (q) => q.eq('sellers.country', locality.country).eq('sellers.suburb', locality.suburb!),
    })
  }
  if (locality.postcode) {
    rungs.push({
      rung: 'postcode',
      apply: (q) => q.eq('sellers.country', locality.country).eq('sellers.postcode', locality.postcode!),
    })
  }
  if (locality.city) {
    rungs.push({
      rung: 'city',
      apply: (q) => q.eq('sellers.country', locality.country).eq('sellers.city', locality.city!),
    })
  }
  rungs.push({
    rung: 'national',
    apply: (q) => q.eq('sellers.country', locality.country),
  })

  let widest: LocalResult = { rows: [], rung: null }

  for (const { rung, apply } of rungs) {
    const { data } = await apply(baseQuery(orFilter, priceMax))
    const rows = data ?? []
    // Keep the widest non-empty result: a tighter rung finding one item
    // shouldn't discard the four the next rung out would have found.
    if (rows.length > widest.rows.length) widest = { rows, rung }
    if (rows.length >= enough) return { rows, rung }
  }

  return widest
}
