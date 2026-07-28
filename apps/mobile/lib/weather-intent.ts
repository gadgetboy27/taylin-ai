/**
 * Weather types and question parsing — pure, no network and no react-native
 * imports, so this can be exercised directly. weather-api.ts owns the fetch.
 */

export type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder'

export type DayForecast = {
  date: string
  condition: Condition
  description: string
  maxC: number
  minC: number
  rainChance: number
}

/**
 * Recognise a weather question before it reaches /intent.
 *
 * Deliberately a keyword test rather than an LLM call: /intent costs a model
 * round trip and writes a `searches` row, neither of which makes sense for
 * "what's the weather tomorrow". Weather vocabulary is small and distinctive,
 * so a regex is both cheaper and faster than asking a model to classify it.
 */
const WEATHER_WORDS = /\b(weather|forecast|rain(ing|y)?|sunny|snow(ing)?|temperature|degrees|hot|cold|windy|umbrella)\b/i

export type WeatherQuery = { dayOffset: number; label: string }

/**
 * Resolve a spoken day to an offset from *the phone's* today, so "tomorrow"
 * means tomorrow where the user is standing rather than where the server runs.
 */
export function detectWeatherQuery(text: string, now: Date = new Date()): WeatherQuery | null {
  if (!WEATHER_WORDS.test(text)) return null
  const t = text.toLowerCase()

  if (/\bday after tomorrow\b/.test(t)) return { dayOffset: 2, label: 'Day after tomorrow' }
  if (/\btomorrow\b/.test(t)) return { dayOffset: 1, label: 'Tomorrow' }
  if (/\b(today|right now|currently|at the moment)\b/.test(t)) return { dayOffset: 0, label: 'Today' }

  // Named weekday → the next occurrence, counting today as 0.
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 0; i < days.length; i++) {
    if (new RegExp(`\\b${days[i]}\\b`).test(t)) {
      const offset = (i - now.getDay() + 7) % 7
      const label = offset === 0
        ? 'Today'
        : days[i][0].toUpperCase() + days[i].slice(1)
      return { dayOffset: offset, label }
    }
  }

  if (/\b(this )?weekend\b/.test(t)) {
    const offset = (6 - now.getDay() + 7) % 7   // next Saturday
    return { dayOffset: offset, label: 'Saturday' }
  }

  return { dayOffset: 0, label: 'Today' }
}

export const cToF = (c: number) => Math.round((c * 9) / 5 + 32)
