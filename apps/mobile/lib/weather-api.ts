import { supabase } from './supabase'
import type { DayForecast } from './weather-intent'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export * from './weather-intent'

export async function getForecast(params: {
  lat: number
  lng: number
  days: number
}): Promise<DayForecast[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const url =
    `${API_URL}/weather?lat=${params.lat}&lng=${params.lng}&days=${params.days}`
  const res = await fetch(url, {
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null })) as { error?: string }
    throw new Error(error ?? 'Could not get the forecast')
  }
  const { forecast } = await res.json() as { forecast: DayForecast[] }
  return forecast
}

