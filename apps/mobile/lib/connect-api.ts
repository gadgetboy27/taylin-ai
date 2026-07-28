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

export type ConnectStatus = {
  identityVerified: boolean
  payoutsEnabled: boolean
  /** Stripe requirement keys still outstanding, e.g. "individual.id_number". */
  outstanding: string[]
  trustTier: 1 | 2 | 3
}

/** Returns a Stripe-hosted URL where the seller completes identity checks. */
export async function startConnectOnboarding(): Promise<string> {
  const res = await fetch(`${API_URL}/connect/onboard`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null })) as { error?: string }
    throw new Error(error ?? 'Could not start Stripe onboarding')
  }
  const { url } = await res.json() as { url: string }
  return url
}

/** Re-reads Stripe and updates identity_verified + trust tier server-side. */
export async function syncConnectStatus(): Promise<ConnectStatus> {
  const res = await fetch(`${API_URL}/connect/sync`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null })) as { error?: string }
    throw new Error(error ?? 'Could not check your Stripe status')
  }
  return res.json() as Promise<ConnectStatus>
}
