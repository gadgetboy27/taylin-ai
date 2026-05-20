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
