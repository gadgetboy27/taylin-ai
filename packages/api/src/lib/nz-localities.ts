/**
 * Server-side NZ locality table.
 *
 * Generated from apps/mobile/lib/nz-localities.ts — keep them in step. The
 * client copy carries coordinates for the map and the GPS match; the server
 * only ever needs to normalise what a seller typed, so coordinates are omitted
 * here rather than duplicated.
 *
 * This exists because the seller interview captured location as prose. The
 * first real seller stored a city of
 *   "Paihia, Te Tokerou (Te Tai Tokerau), Northland; serves North Island"
 * which no buyer could ever match, so the suburb rung of the search ladder in
 * routes/search.ts was dead on arrival. Normalising both sides through one
 * table is what makes local matching work at all.
 */

export type Locality = { suburb: string; city: string; postcode: string }

export const NZ_LOCALITIES: Locality[] = [
  { suburb: "Kaitaia", city: "Kaitaia", postcode: "0410" },
  { suburb: "Paihia", city: "Paihia", postcode: "0200" },
  { suburb: "Kerikeri", city: "Kerikeri", postcode: "0230" },
  { suburb: "Whangārei", city: "Whangārei", postcode: "0110" },
  { suburb: "Dargaville", city: "Dargaville", postcode: "0310" },
  { suburb: "Auckland Central", city: "Auckland", postcode: "1010" },
  { suburb: "Ponsonby", city: "Auckland", postcode: "1011" },
  { suburb: "Newmarket", city: "Auckland", postcode: "1023" },
  { suburb: "Takapuna", city: "Auckland", postcode: "0622" },
  { suburb: "Henderson", city: "Auckland", postcode: "0612" },
  { suburb: "Manukau", city: "Auckland", postcode: "2104" },
  { suburb: "Papakura", city: "Auckland", postcode: "2110" },
  { suburb: "Orewa", city: "Auckland", postcode: "0931" },
  { suburb: "Hamilton Central", city: "Hamilton", postcode: "3204" },
  { suburb: "Cambridge", city: "Cambridge", postcode: "3434" },
  { suburb: "Tauranga", city: "Tauranga", postcode: "3110" },
  { suburb: "Mount Maunganui", city: "Tauranga", postcode: "3116" },
  { suburb: "Rotorua", city: "Rotorua", postcode: "3010" },
  { suburb: "Taupō", city: "Taupō", postcode: "3330" },
  { suburb: "Whakatāne", city: "Whakatāne", postcode: "3120" },
  { suburb: "Gisborne", city: "Gisborne", postcode: "4010" },
  { suburb: "Napier", city: "Napier", postcode: "4110" },
  { suburb: "Hastings", city: "Hastings", postcode: "4122" },
  { suburb: "New Plymouth", city: "New Plymouth", postcode: "4310" },
  { suburb: "Whanganui", city: "Whanganui", postcode: "4500" },
  { suburb: "Palmerston North", city: "Palmerston North", postcode: "4410" },
  { suburb: "Masterton", city: "Masterton", postcode: "5810" },
  { suburb: "Levin", city: "Levin", postcode: "5510" },
  { suburb: "Paraparaumu", city: "Paraparaumu", postcode: "5032" },
  { suburb: "Porirua", city: "Porirua", postcode: "5022" },
  { suburb: "Lower Hutt", city: "Lower Hutt", postcode: "5010" },
  { suburb: "Upper Hutt", city: "Upper Hutt", postcode: "5018" },
  { suburb: "Te Aro", city: "Wellington", postcode: "6011" },
  { suburb: "Wellington Central", city: "Wellington", postcode: "6011" },
  { suburb: "Karori", city: "Wellington", postcode: "6012" },
  { suburb: "Miramar", city: "Wellington", postcode: "6022" },
  { suburb: "Nelson", city: "Nelson", postcode: "7010" },
  { suburb: "Richmond", city: "Nelson", postcode: "7020" },
  { suburb: "Blenheim", city: "Blenheim", postcode: "7201" },
  { suburb: "Motueka", city: "Motueka", postcode: "7120" },
  { suburb: "Greymouth", city: "Greymouth", postcode: "7805" },
  { suburb: "Christchurch Central", city: "Christchurch", postcode: "8011" },
  { suburb: "Riccarton", city: "Christchurch", postcode: "8041" },
  { suburb: "Papanui", city: "Christchurch", postcode: "8052" },
  { suburb: "Rangiora", city: "Rangiora", postcode: "7400" },
  { suburb: "Ashburton", city: "Ashburton", postcode: "7700" },
  { suburb: "Timaru", city: "Timaru", postcode: "7910" },
  { suburb: "Queenstown", city: "Queenstown", postcode: "9300" },
  { suburb: "Wānaka", city: "Wānaka", postcode: "9305" },
  { suburb: "Cromwell", city: "Cromwell", postcode: "9310" },
  { suburb: "Oamaru", city: "Oamaru", postcode: "9400" },
  { suburb: "Dunedin Central", city: "Dunedin", postcode: "9016" },
  { suburb: "Invercargill", city: "Invercargill", postcode: "9810" },
  { suburb: "Gore", city: "Gore", postcode: "9710" },
]

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Resolve whatever the seller said into canonical suburb/city/postcode.
 * Postcode wins when present — it is the least ambiguous thing they give us —
 * then an exact name, then a name mentioned anywhere in the sentence.
 */
export function normaliseLocality(input: {
  postcode?: string | null
  text?: string | null
}): Locality | null {
  const pc = (input.postcode ?? "").trim()
  if (pc) {
    const byPostcode = NZ_LOCALITIES.find((l) => l.postcode === pc)
    if (byPostcode) return byPostcode
  }

  const t = fold(input.text ?? "")
  if (!t) return null

  const exact =
    NZ_LOCALITIES.find((l) => fold(l.suburb) === t) ??
    NZ_LOCALITIES.find((l) => fold(l.city) === t)
  if (exact) return exact

  // Longest first so "Auckland Central" beats "Auckland" in the same sentence.
  const bySuburb = [...NZ_LOCALITIES].sort((a, b) => b.suburb.length - a.suburb.length)
  const inSuburb = bySuburb.find((l) => t.includes(fold(l.suburb)))
  if (inSuburb) return inSuburb

  const byCity = [...NZ_LOCALITIES].sort((a, b) => b.city.length - a.city.length)
  return byCity.find((l) => t.includes(fold(l.city))) ?? null
}
