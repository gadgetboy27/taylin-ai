/**
 * TrackingMore — multi-carrier shipment tracking lookups.
 * Set TRACKINGMORE_API_KEY in packages/api/.env to enable.
 * Docs: https://www.trackingmore.com/docs
 *
 * This is a thin lookup/registration wrapper, not a booking integration —
 * the courier is picked from Taylin's own curated directory (couriers
 * table); TrackingMore is only asked to track a tracking number once one
 * exists.
 */

const API_KEY = process.env.TRACKINGMORE_API_KEY
const BASE = 'https://api.trackingmore.com/v4'

export const isTrackingMoreConfigured = !!API_KEY

export type TrackingStatus = {
  trackingNumber: string
  courierCode: string
  status: string          // e.g. "pending", "transit", "delivered", "exception"
  lastUpdate: string | null
}

function headers(): Record<string, string> {
  return {
    'Tracking-Api-Key': API_KEY ?? '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

// Registers a tracking number with TrackingMore so its status can be polled
// or pushed via webhook. Safe to call more than once for the same number —
// TrackingMore treats a duplicate registration as a no-op, not an error.
export async function registerTracking(trackingNumber: string, courierCode: string): Promise<boolean> {
  if (!API_KEY) {
    console.warn('[trackingmore] TRACKINGMORE_API_KEY not set — skipping registration')
    return false
  }

  try {
    const res = await fetch(`${BASE}/trackings/create`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ tracking_number: trackingNumber, courier_code: courierCode }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function getTrackingStatus(trackingNumber: string, courierCode: string): Promise<TrackingStatus | null> {
  if (!API_KEY) return null

  try {
    const res = await fetch(
      `${BASE}/trackings/get?tracking_numbers=${encodeURIComponent(trackingNumber)}&courier_code=${encodeURIComponent(courierCode)}`,
      { headers: headers() }
    )
    if (!res.ok) return null

    const raw = await res.json() as {
      data?: Array<{
        tracking_number?: string
        courier_code?: string
        delivery_status?: string
        latest_event_time?: string
      }>
    }

    const entry = raw.data?.[0]
    if (!entry) return null

    return {
      trackingNumber: entry.tracking_number ?? trackingNumber,
      courierCode: entry.courier_code ?? courierCode,
      status: entry.delivery_status ?? 'pending',
      lastUpdate: entry.latest_event_time ?? null,
    }
  } catch {
    return null
  }
}
