/**
 * Pulls a city and NZ postcode out of a spoken phrase like
 * "I'm in Wellington, 6011" or "my address is 12 Cuba Street Te Aro 6011".
 *
 * Deliberately loose: transcription is imperfect and a wrong postcode silently
 * mistargets deal broadcast (lib/broadcast.ts matches on it exactly), so the
 * caller shows the parsed values for confirmation rather than saving straight
 * away. This only has to produce a good first guess.
 */

// NZ postcodes are always four digits.
const POSTCODE = /\b(\d{4})\b/

// Lead-ins people actually say. Stripped so they don't end up in the city.
const FILLER = /\b(i(?:'m| am)?|we(?:'re| are)?|live|living|located|based|reside|my|the|and|address|postcode|post code|zip|city|town|suburb|is|in|at|of|it'?s)\b/gi

export type ParsedAddress = {
  city: string
  postcode: string
  /** The raw phrase, kept verbatim as the free-text address line. */
  addressText: string
}

export function parseSpokenAddress(transcript: string): ParsedAddress {
  const raw = transcript.trim()
  const postcode = raw.match(POSTCODE)?.[1] ?? ''

  const city = raw
    .replace(POSTCODE, ' ')
    .replace(FILLER, ' ')
    // Street lines ("12 Cuba Street") aren't the city — drop leading numbers.
    .replace(/\b\d+\b/g, ' ')
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Title-case what's left so "wellington" reads as "Wellington".
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  return { city, postcode, addressText: raw }
}
