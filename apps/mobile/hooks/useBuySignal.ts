import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL

export type MonitorType = 'price_drop' | 'availability' | 'date'

export function useBuySignal() {
  const createMonitor = useCallback(async (params: {
    searchId: string
    monitorType: MonitorType
    targetPrice?: number
    route?: string
    checkIntervalHours?: number
  }): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(`${API_URL}/signals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
    })

    if (!res.ok) throw new Error('Could not create buy signal monitor')
  }, [])

  return { createMonitor }
}
