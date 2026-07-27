import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type AppNotification = {
  id: string
  title: string
  body: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

const POLL_INTERVAL_MS = 30_000

// Pull-side notification feed. Polls rather than subscribing to Supabase
// realtime for the MVP — realtime is a natural upgrade later, not needed to
// ship this. RLS on the notifications table already scopes rows to the
// logged-in user, so no explicit .eq('user_id', ...) filter is needed here.
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, data, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications((data as AppNotification[]) ?? [])
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    )
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return { notifications, loading, unreadCount, refresh, markRead }
}
