import { supabase } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export type InterviewMessage = {
  role: 'taylor' | 'seller'
  content: string
  ts: string
  verificationResult?: {
    type: 'nzbn' | 'url' | 'search'
    success: boolean
    label: string
  }
}

export type StartResponse = {
  applicationId: string
  message: string
  conversation: InterviewMessage[]
  resuming: boolean
}

export type MessageResponse = {
  message: string
  complete: boolean
  verification: InterviewMessage['verificationResult'] | null
  conversation: InterviewMessage[]
  // Only present when complete === true
  tier?: 1 | 2 | 3
  summary?: string
  sellerId?: string
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  }
}

export async function startInterview(): Promise<StartResponse> {
  const res = await fetch(`${API_URL}/sellers/apply/start`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to start interview')
  return res.json() as Promise<StartResponse>
}

export async function sendMessage(
  applicationId: string,
  message: string
): Promise<MessageResponse> {
  const res = await fetch(`${API_URL}/sellers/apply/message`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ applicationId, message }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json() as Promise<MessageResponse>
}

export type SellerProfile = {
  id: string
  business_name: string
  trust_tier: 1 | 2 | 3
  gst_registered: boolean
  identity_verified: boolean
  total_orders: number
  onboarded_at: string | null
}

// Returns null if the logged-in user has no seller profile yet (not a 404 —
// callers use this to decide whether to show the dashboard or the landing page).
export async function getMySellerProfile(): Promise<SellerProfile | null> {
  const res = await fetch(`${API_URL}/sellers/me`, {
    headers: await authHeaders(),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to load seller profile')
  const { seller } = await res.json() as { seller: SellerProfile }
  return seller
}
