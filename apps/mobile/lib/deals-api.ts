import { supabase } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export type Deal = {
  id: string
  title: string
  description: string | null
  price: number
  currency: string
  quantity_remaining: number
  expires_at: string
  // suburb/postcode drive the map pin: lib/nz-localities resolves them to
  // coordinates offline, so plotting a deal needs no geocoding call.
  sellers: {
    business_name: string
    city: string | null
    suburb: string | null
    postcode: string | null
    country: string | null
  } | null
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

export async function listDeals(): Promise<Deal[]> {
  const res = await fetch(`${API_URL}/deals`)
  if (!res.ok) throw new Error('Failed to load deals')
  const { deals } = await res.json() as { deals: Deal[] }
  return deals
}

export async function createDeal(params: {
  title: string
  description?: string
  price: number
  quantity: number
  expiresAt: string
}): Promise<{ dealId: string }> {
  const res = await fetch(`${API_URL}/deals`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to create deal')
  return res.json() as Promise<{ dealId: string }>
}

export async function claimDeal(dealId: string): Promise<{ claimed: boolean; remaining: number }> {
  const res = await fetch(`${API_URL}/deals/${dealId}/claim`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to claim deal')
  return res.json() as Promise<{ claimed: boolean; remaining: number }>
}
