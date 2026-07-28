/**
 * Forecasts via Open-Meteo — free, no API key, no signup, no attribution
 * requirement, and it resolves NZ timezones correctly.
 *
 * MapTiler's Weather API was the obvious candidate given we already pay for
 * that key, but it serves animated map layers rather than point forecasts, so
 * it can't answer "what's the weather tomorrow" in words.
 *
 * Proxied through the API rather than called from the browser so the response
 * can be cached later and so the app keeps a single outbound-call boundary.
 */

export type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder'

export type DayForecast = {
  /** ISO date in the location's own timezone, not the server's. */
  date: string
  condition: Condition
  description: string
  maxC: number
  minC: number
  /** Chance of precipitation, percent. */
  rainChance: number
}

// WMO weather interpretation codes, grouped to the handful of icons worth
// distinguishing at a glance. The full table has ~28 values; a buyer deciding
// whether to walk to a shop does not need "light freezing drizzle".
const WMO: Record<number, [Condition, string]> = {
  0: ['clear', 'Clear'],
  1: ['partly', 'Mostly clear'],
  2: ['partly', 'Partly cloudy'],
  3: ['cloudy', 'Overcast'],
  45: ['fog', 'Fog'], 48: ['fog', 'Freezing fog'],
  51: ['drizzle', 'Light drizzle'], 53: ['drizzle', 'Drizzle'], 55: ['drizzle', 'Heavy drizzle'],
  56: ['drizzle', 'Freezing drizzle'], 57: ['drizzle', 'Freezing drizzle'],
  61: ['rain', 'Light rain'], 63: ['rain', 'Rain'], 65: ['rain', 'Heavy rain'],
  66: ['rain', 'Freezing rain'], 67: ['rain', 'Freezing rain'],
  71: ['snow', 'Light snow'], 73: ['snow', 'Snow'], 75: ['snow', 'Heavy snow'],
  77: ['snow', 'Snow grains'],
  80: ['rain', 'Light showers'], 81: ['rain', 'Showers'], 82: ['rain', 'Heavy showers'],
  85: ['snow', 'Snow showers'], 86: ['snow', 'Heavy snow showers'],
  95: ['thunder', 'Thunderstorm'], 96: ['thunder', 'Thunderstorm with hail'],
  99: ['thunder', 'Thunderstorm with hail'],
}

export async function getForecast(params: {
  lat: number
  lng: number
  days: number
}): Promise<DayForecast[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(params.lat))
  url.searchParams.set('longitude', String(params.lng))
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max')
  // Let Open-Meteo resolve the zone from the coordinates: asking for a forecast
  // "tomorrow" in NZ from a US-hosted server would otherwise be off by a day.
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', String(Math.min(Math.max(params.days, 1), 7)))

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Forecast unavailable (${res.status})`)

  const data = await res.json() as {
    daily: {
      time: string[]
      weather_code: number[]
      temperature_2m_max: number[]
      temperature_2m_min: number[]
      precipitation_probability_max: (number | null)[]
    }
  }

  const d = data.daily
  return d.time.map((date, i) => {
    const [condition, description] = WMO[d.weather_code[i]] ?? ['cloudy', 'Unsettled']
    return {
      date,
      condition,
      description,
      maxC: Math.round(d.temperature_2m_max[i]),
      minC: Math.round(d.temperature_2m_min[i]),
      rainChance: d.precipitation_probability_max[i] ?? 0,
    }
  })
}
