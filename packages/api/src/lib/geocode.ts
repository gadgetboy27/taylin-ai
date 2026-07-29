/**
 * Address lookup for sellers whose town isn't in the offline table.
 *
 * lib/nz-localities.ts covers ~54 main centres, which places most sellers for
 * free. It cannot place Ōpōtiki, Waiuku, Raglan or the hundreds of other NZ
 * towns — and a seller it can't place gets no map pin and never matches the
 * suburb rung of the ladder in routes/search.ts. This fills that gap, and only
 * that gap: it is called when the offline table misses, never before it.
 *
 * Needs its OWN key, separate from EXPO_PUBLIC_MAPTILER_KEY. That one is
 * origin-restricted to the web app (correctly — it ships in the browser
 * bundle), so a server-side call with no Origin header is refused with 403.
 * Restrict this one by user-agent instead, which is what MapTiler offers for
 * non-browser clients; the UA below is what it should be pinned to.
 *
 * Absent a key, this returns null and the caller falls back to whatever the
 * seller typed. Degraded, not broken.
 */

const KEY = process.env.MAPTILER_API_KEY
const USER_AGENT = 'taylin-ai-server/1.0'

export type GeocodedPlace = {
  suburb: string
  city: string
  postcode: string | null
  lat: number
  lng: number
}

type Feature = {
  place_name?: string
  place_type?: string[]
  text?: string
  center?: [number, number]
  context?: { id?: string; text?: string }[]
}

/** Pull the first context entry whose id starts with `prefix` (e.g. "region."). */
function contextText(f: Feature, prefix: string): string | null {
  return f.context?.find((ctx) => ctx.id?.startsWith(prefix))?.text ?? null
}

export const isGeocodingConfigured = !!KEY

/**
 * Resolve free text to an NZ place. Restricted to New Zealand so a seller
 * typing "Richmond" can't land in Virginia.
 */
export async function geocodeNZ(query: string): Promise<GeocodedPlace | null> {
  if (!KEY) return null
  const q = query.trim()
  if (q.length < 2) return null

  try {
    const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json`)
    url.searchParams.set('country', 'nz')
    url.searchParams.set('limit', '1')
    url.searchParams.set('key', KEY)

    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null

    const { features } = await res.json() as { features?: Feature[] }
    const f = features?.[0]
    if (!f?.center) return null

    // A postcode only appears when the query resolved to a street address; a
    // town-level match has none, and inventing one would be worse than a null.
    const postcode =
      contextText(f, 'postal_code') ??
      f.place_name?.match(/\b(\d{4})\b/)?.[1] ??
      null

    const town = f.text ?? f.place_name?.split(',')[0]?.trim() ?? q
    // MapTiler's NZ hierarchy is district → region, neither of which is a
    // "city" in the sense buyers type. The town itself is the closest match,
    // with the district as the wider label.
    const district = contextText(f, 'county.') ?? contextText(f, 'region.') ?? town

    return {
      suburb: town,
      city: town,
      postcode,
      lat: f.center[1],
      lng: f.center[0],
      // district kept out of the return deliberately — sellers.city is matched
      // against what buyers say, and nobody says "Ōpōtiki District".
    } satisfies GeocodedPlace & Record<string, unknown> as GeocodedPlace
  } catch {
    return null
  }
}
