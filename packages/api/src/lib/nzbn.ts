/**
 * NZBN (New Zealand Business Number) registry lookup.
 * Free API — get a key at https://api.business.govt.nz (takes ~2 mins).
 * Set NZBN_API_KEY in packages/api/.env to enable.
 */

const API_KEY = process.env.NZBN_API_KEY
const BASE = 'https://api.business.govt.nz/gateway/nzbn/v5'

export const isNzbnConfigured = !!API_KEY

export type NzbnResult = {
  nzbn: string
  entityName: string
  entityTypeCode: string     // e.g. "LTDCO", "SOLE_TRADER", "PARTNERSHIP"
  entityStatusCode: string   // e.g. "REGISTERED", "REMOVED"
  gstRegistered: boolean
  registrationDate: string | null
  address: string | null
}

export async function lookupNZBN(nzbn: string): Promise<NzbnResult | null> {
  // Strip spaces and dashes — NZBNs are 13 digits
  const clean = nzbn.replace(/[\s\-]/g, '')
  if (!/^\d{13}$/.test(clean)) return null

  if (!API_KEY) {
    console.warn('[nzbn] NZBN_API_KEY not set — skipping NZBN lookup')
    return null
  }

  try {
    const res = await fetch(`${BASE}/entities/${clean}`, {
      headers: {
        'Ocp-Apim-Subscription-Key': API_KEY,
        Accept: 'application/json',
      },
    })
    if (!res.ok) return null

    const raw = await res.json() as {
      nzbn?: string
      entityName?: string
      entityTypeCode?: string
      entityStatusCode?: string
      gstNumbers?: Array<{ gstStatus?: string }>
      registrationDate?: string
      registeredAddress?: { addressLine?: string[] }
    }

    const addressParts = raw.registeredAddress?.addressLine ?? []
    const gstRegistered = (raw.gstNumbers ?? []).some(
      (g) => g.gstStatus === 'REGISTERED'
    )

    return {
      nzbn: raw.nzbn ?? clean,
      entityName: raw.entityName ?? '',
      entityTypeCode: raw.entityTypeCode ?? '',
      entityStatusCode: raw.entityStatusCode ?? '',
      gstRegistered,
      registrationDate: raw.registrationDate ?? null,
      address: addressParts.join(', ') || null,
    }
  } catch {
    return null
  }
}

export function nzbnSummary(result: NzbnResult): string {
  const status = result.entityStatusCode === 'REGISTERED' ? 'Active' : result.entityStatusCode
  const gst = result.gstRegistered ? ' · GST registered' : ''
  return `${result.entityName} — ${status}${gst}`
}
