import { supabase, isDevMode } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export interface ResearchAnswer {
  answer: string
  followUps: string[]
  sources: Array<{ title: string; url: string }>
}

export async function askResearch(query: string): Promise<ResearchAnswer> {
  const res = await fetch(`${API_URL}/research`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Research failed: ${res.status}`)
  return res.json()
}

// Dev mode stub products — shown when no backend is running
const DEV_RESULTS = [
  {
    id: 'dev-1',
    name: 'Single Origin Ethiopian Yirgacheffe',
    description: 'Light roast, 250g bag. Floral and citrus notes.',
    price: 24.99,
    currency: 'NZD',
    images: [],
    seller_id: 'dev-seller-1',
    delivery_days_min: 2,
    delivery_days_max: 4,
    sellerTier: 1 as const,
    aiSummary: 'Best match — single origin, fits your preference for light roasts.',
  },
  {
    id: 'dev-2',
    name: 'Ethiopian Sidamo Dark Roast',
    description: 'Rich and bold, 500g. Great for espresso.',
    price: 34.99,
    currency: 'NZD',
    images: [],
    seller_id: 'dev-seller-2',
    delivery_days_min: 1,
    delivery_days_max: 3,
    sellerTier: 2 as const,
    aiSummary: 'Larger bag, better value. Escrow protected.',
  },
  {
    id: 'dev-3',
    name: 'Ethiopian Blend — Harar & Yirgacheffe',
    description: 'A blended lot. 200g, medium roast.',
    price: 18.5,
    currency: 'NZD',
    images: [],
    seller_id: 'dev-seller-3',
    delivery_days_min: 3,
    delivery_days_max: 6,
    sellerTier: 3 as const,
    aiSummary: 'Budget pick. P2P seller — escrow via SafeSend.',
  },
]

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  }
}

export async function parseIntent(prompt: string): Promise<{
  searchId: string
  brief: Record<string, unknown>
}> {
  if (isDevMode) {
    await new Promise((r) => setTimeout(r, 800))
    return { searchId: `dev-${Date.now()}`, brief: { category: 'retail', searchTerms: [prompt] } }
  }
  const res = await fetch(`${API_URL}/intent`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) throw new Error('Intent parsing failed')
  return res.json()
}

export async function fetchResults(searchId: string): Promise<unknown[]> {
  if (isDevMode || searchId.startsWith('dev-')) {
    await new Promise((r) => setTimeout(r, 600))
    return DEV_RESULTS
  }
  const res = await fetch(`${API_URL}/search/${searchId}`, {
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error('Search failed')
  const data = await res.json() as { results: unknown[] }
  return data.results
}
