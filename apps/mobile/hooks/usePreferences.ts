import { useEffect, useState } from 'react'
import { supabase, isDevMode } from '@/lib/supabase'

export type Preference = {
  id: string
  category: string
  positive_signals: string[]
  negative_signals: string[]
  last_updated: string
}

export type RecentSearch = {
  id: string
  raw_prompt: string
  created_at: string
}

// Dev mode stubs — shown when no real Supabase session exists
const DEV_RECENT_SEARCHES: RecentSearch[] = [
  { id: '1', raw_prompt: 'Ethiopian coffee beans', created_at: new Date().toISOString() },
  { id: '2', raw_prompt: 'flights to Sydney under $400', created_at: new Date().toISOString() },
  { id: '3', raw_prompt: 'noise cancelling headphones', created_at: new Date().toISOString() },
]

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isDevMode) {
      setRecentSearches(DEV_RECENT_SEARCHES)
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) {
        setLoading(false)
        return
      }

      const [prefResult, searchResult] = await Promise.all([
        supabase
          .from('preferences')
          .select('id, category, positive_signals, negative_signals, last_updated')
          .eq('user_id', user.id)
          .order('last_updated', { ascending: false })
          .limit(10),
        supabase
          .from('searches')
          .select('id, raw_prompt, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      if (!cancelled) {
        setPreferences(prefResult.data || [])
        setRecentSearches(searchResult.data || [])
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { preferences, recentSearches, loading }
}
