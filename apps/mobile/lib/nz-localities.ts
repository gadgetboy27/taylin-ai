/**
 * A small offline table of NZ localities.
 *
 * Both ways of establishing where someone is resolve against this, so neither
 * costs an API call:
 *   - spoken ("I'm in Paihia")  → matchLocalityByName
 *   - GPS (lat/lng from device) → nearestLocality
 *
 * Reverse geocoding a coordinate normally means a paid lookup or a Nominatim
 * dependency. Carrying coordinates here instead makes GPS a pure distance
 * calculation — free, instant, offline, and identical on web and native, which
 * matters because expo-location's reverseGeocodeAsync doesn't exist on web.
 *
 * Deliberately a starter set of main centres and notable towns rather than
 * every NZ suburb: it's enough to place most buyers, and anything unmatched
 * falls back to the typed fields rather than blocking them. Extend as real
 * usage shows what's missing.
 */

export type Locality = {
  suburb: string
  city: string
  postcode: string
  lat: number
  lng: number
}

export const NZ_LOCALITIES: Locality[] = [
  // Northland
  { suburb: 'Kaitaia', city: 'Kaitaia', postcode: '0410', lat: -35.113, lng: 173.264 },
  { suburb: 'Paihia', city: 'Paihia', postcode: '0200', lat: -35.283, lng: 174.091 },
  { suburb: 'Kerikeri', city: 'Kerikeri', postcode: '0230', lat: -35.227, lng: 173.948 },
  { suburb: 'Whangārei', city: 'Whangārei', postcode: '0110', lat: -35.725, lng: 174.323 },
  { suburb: 'Dargaville', city: 'Dargaville', postcode: '0310', lat: -35.939, lng: 173.874 },

  // Auckland
  { suburb: 'Auckland Central', city: 'Auckland', postcode: '1010', lat: -36.848, lng: 174.763 },
  { suburb: 'Ponsonby', city: 'Auckland', postcode: '1011', lat: -36.855, lng: 174.745 },
  { suburb: 'Newmarket', city: 'Auckland', postcode: '1023', lat: -36.869, lng: 174.777 },
  { suburb: 'Takapuna', city: 'Auckland', postcode: '0622', lat: -36.788, lng: 174.774 },
  { suburb: 'Henderson', city: 'Auckland', postcode: '0612', lat: -36.879, lng: 174.629 },
  { suburb: 'Manukau', city: 'Auckland', postcode: '2104', lat: -36.993, lng: 174.879 },
  { suburb: 'Papakura', city: 'Auckland', postcode: '2110', lat: -37.066, lng: 174.944 },
  { suburb: 'Orewa', city: 'Auckland', postcode: '0931', lat: -36.585, lng: 174.694 },

  // Waikato / Bay of Plenty
  { suburb: 'Hamilton Central', city: 'Hamilton', postcode: '3204', lat: -37.787, lng: 175.279 },
  { suburb: 'Cambridge', city: 'Cambridge', postcode: '3434', lat: -37.888, lng: 175.470 },
  { suburb: 'Tauranga', city: 'Tauranga', postcode: '3110', lat: -37.687, lng: 176.166 },
  { suburb: 'Mount Maunganui', city: 'Tauranga', postcode: '3116', lat: -37.639, lng: 176.184 },
  { suburb: 'Rotorua', city: 'Rotorua', postcode: '3010', lat: -38.137, lng: 176.249 },
  { suburb: 'Taupō', city: 'Taupō', postcode: '3330', lat: -38.685, lng: 176.070 },
  { suburb: 'Whakatāne', city: 'Whakatāne', postcode: '3120', lat: -37.953, lng: 176.985 },

  // Gisborne / Hawke's Bay / Taranaki
  { suburb: 'Gisborne', city: 'Gisborne', postcode: '4010', lat: -38.662, lng: 178.018 },
  { suburb: 'Napier', city: 'Napier', postcode: '4110', lat: -39.493, lng: 176.912 },
  { suburb: 'Hastings', city: 'Hastings', postcode: '4122', lat: -39.639, lng: 176.844 },
  { suburb: 'New Plymouth', city: 'New Plymouth', postcode: '4310', lat: -39.056, lng: 174.076 },
  { suburb: 'Whanganui', city: 'Whanganui', postcode: '4500', lat: -39.930, lng: 175.048 },

  // Manawatū / Wairarapa / Wellington
  { suburb: 'Palmerston North', city: 'Palmerston North', postcode: '4410', lat: -40.356, lng: 175.611 },
  { suburb: 'Masterton', city: 'Masterton', postcode: '5810', lat: -40.951, lng: 175.658 },
  { suburb: 'Levin', city: 'Levin', postcode: '5510', lat: -40.622, lng: 175.286 },
  { suburb: 'Paraparaumu', city: 'Paraparaumu', postcode: '5032', lat: -40.917, lng: 174.982 },
  { suburb: 'Porirua', city: 'Porirua', postcode: '5022', lat: -41.134, lng: 174.840 },
  { suburb: 'Lower Hutt', city: 'Lower Hutt', postcode: '5010', lat: -41.209, lng: 174.908 },
  { suburb: 'Upper Hutt', city: 'Upper Hutt', postcode: '5018', lat: -41.125, lng: 175.070 },
  { suburb: 'Te Aro', city: 'Wellington', postcode: '6011', lat: -41.294, lng: 174.776 },
  { suburb: 'Wellington Central', city: 'Wellington', postcode: '6011', lat: -41.286, lng: 174.776 },
  { suburb: 'Karori', city: 'Wellington', postcode: '6012', lat: -41.284, lng: 174.738 },
  { suburb: 'Miramar', city: 'Wellington', postcode: '6022', lat: -41.315, lng: 174.816 },

  // Top of the South
  { suburb: 'Nelson', city: 'Nelson', postcode: '7010', lat: -41.271, lng: 173.284 },
  { suburb: 'Richmond', city: 'Nelson', postcode: '7020', lat: -41.341, lng: 173.183 },
  { suburb: 'Blenheim', city: 'Blenheim', postcode: '7201', lat: -41.514, lng: 173.961 },
  { suburb: 'Motueka', city: 'Motueka', postcode: '7120', lat: -41.112, lng: 173.011 },
  { suburb: 'Greymouth', city: 'Greymouth', postcode: '7805', lat: -42.450, lng: 171.210 },

  // Canterbury
  { suburb: 'Christchurch Central', city: 'Christchurch', postcode: '8011', lat: -43.531, lng: 172.637 },
  { suburb: 'Riccarton', city: 'Christchurch', postcode: '8041', lat: -43.531, lng: 172.590 },
  { suburb: 'Papanui', city: 'Christchurch', postcode: '8052', lat: -43.492, lng: 172.606 },
  { suburb: 'Rangiora', city: 'Rangiora', postcode: '7400', lat: -43.305, lng: 172.595 },
  { suburb: 'Ashburton', city: 'Ashburton', postcode: '7700', lat: -43.903, lng: 171.746 },
  { suburb: 'Timaru', city: 'Timaru', postcode: '7910', lat: -44.397, lng: 171.255 },

  // Otago / Southland
  { suburb: 'Queenstown', city: 'Queenstown', postcode: '9300', lat: -45.031, lng: 168.663 },
  { suburb: 'Wānaka', city: 'Wānaka', postcode: '9305', lat: -44.700, lng: 169.145 },
  { suburb: 'Cromwell', city: 'Cromwell', postcode: '9310', lat: -45.038, lng: 169.196 },
  { suburb: 'Oamaru', city: 'Oamaru', postcode: '9400', lat: -45.098, lng: 170.971 },
  { suburb: 'Dunedin Central', city: 'Dunedin', postcode: '9016', lat: -45.874, lng: 170.504 },
  { suburb: 'Invercargill', city: 'Invercargill', postcode: '9810', lat: -46.413, lng: 168.351 },
  { suburb: 'Gore', city: 'Gore', postcode: '9710', lat: -46.103, lng: 168.944 },
]

/** Strips macrons and punctuation so "Whangarei" matches "Whangārei". */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve spoken or typed text to a known locality.
 * Matches suburb first, then city, then a loose contains — transcripts arrive
 * as whole sentences ("I'm up in Paihia at the moment"), not bare place names.
 */
export function matchLocalityByName(text: string): Locality | null {
  const t = fold(text)
  if (!t) return null

  const exactSuburb = NZ_LOCALITIES.find((l) => fold(l.suburb) === t)
  if (exactSuburb) return exactSuburb

  const exactCity = NZ_LOCALITIES.find((l) => fold(l.city) === t)
  if (exactCity) return exactCity

  // Longest name first, so "Auckland Central" wins over "Auckland" when both
  // appear in the sentence.
  const byLength = [...NZ_LOCALITIES].sort((a, b) => b.suburb.length - a.suburb.length)
  const containedSuburb = byLength.find((l) => t.includes(fold(l.suburb)))
  if (containedSuburb) return containedSuburb

  const byCityLength = [...NZ_LOCALITIES].sort((a, b) => b.city.length - a.city.length)
  return byCityLength.find((l) => t.includes(fold(l.city))) ?? null
}

/** Resolve a 4-digit NZ postcode to a locality. */
export function matchLocalityByPostcode(postcode: string): Locality | null {
  return NZ_LOCALITIES.find((l) => l.postcode === postcode.trim()) ?? null
}

/**
 * Nearest known locality to a coordinate — how GPS is resolved without a
 * reverse-geocoding service. Equirectangular approximation, which is ample
 * over NZ distances and avoids the cost of full haversine for a nearest-match.
 */
export function nearestLocality(lat: number, lng: number): { locality: Locality; km: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  let best: Locality | null = null
  let bestKm = Infinity

  for (const l of NZ_LOCALITIES) {
    const x = (l.lng - lng) * Math.cos(((l.lat + lat) / 2) * Math.PI / 180)
    const y = l.lat - lat
    const km = Math.sqrt(x * x + y * y) * 111.32
    if (km < bestKm) { bestKm = km; best = l }
  }

  return best ? { locality: best, km: bestKm } : null
}
