import { supabase } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

export type Address = {
  addressText: string | null
  postcode: string | null
  city: string | null
  suburb: string | null
  country: string | null
}

/**
 * Reads straight from the users table rather than the API — there is no GET
 * endpoint for this, and RLS ("users: own row only", 009_rls_policies.sql)
 * already scopes the row to the signed-in user.
 */
export async function getAddress(): Promise<Address | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('address_text, postcode, city, suburb, country')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return null
  return {
    addressText: data.address_text,
    postcode: data.postcode,
    city: data.city,
    suburb: data.suburb,
    country: data.country,
  }
}

export async function saveAddress(params: {
  addressText?: string
  postcode: string
  city: string
  suburb?: string
  country?: string
}): Promise<void> {
  const res = await fetch(`${API_URL}/profile/address`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null })) as { error?: string }
    throw new Error(error ?? 'Could not save address')
  }
}
