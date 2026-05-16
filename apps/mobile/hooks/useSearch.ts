import { useCallback, useState } from 'react'
import { supabase, isDevMode } from '@/lib/supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export type SearchStatus = 'idle' | 'parsing' | 'searching' | 'done' | 'error'

// Dev mode: returns a fake searchId so the results screen can load
async function devSearch(prompt: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1200)) // simulate latency
  return `dev-${Date.now()}`
}

export function useSearch() {
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const startSearch = useCallback(async (prompt: string): Promise<string> => {
    setStatus('parsing')
    setError(null)

    if (isDevMode) {
      const id = await devSearch(prompt)
      setStatus('done')
      return id
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setStatus('error')
      const message = (body as { error?: string }).error || 'Search failed'
      setError(message)
      throw new Error(message)
    }

    const { searchId } = await response.json() as { searchId: string }
    setStatus('done')
    return searchId
  }, [])

  return { startSearch, status, error }
}
