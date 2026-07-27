/**
 * On-device, append-only behavior log. Nothing here ever leaves the device —
 * see boundary.ts for the one narrow type that's allowed to cross the
 * network, and detector.ts for how this log turns into pattern candidates.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

const EVENTS_KEY = '@taylin/patterns/events'
const LABELS_KEY = '@taylin/patterns/labels'

// Caps unbounded growth — old events roll off once we have far more than any
// realistic pattern window needs (a few months of daily activity).
const MAX_EVENTS = 500

export type BehaviorEventType = 'recurring_purchase' | 'biometric_deviation'

export type BehaviorEvent = {
  id: string
  type: BehaviorEventType
  category: string
  timestamp: string
  dayOfWeek: number   // 0 (Sunday) - 6 (Saturday)
  hourBucket: number  // 0-23, the hour the event occurred in
}

export type ConfirmationLabel = {
  patternKey: string
  confirmed: boolean
  answeredAt: string
}

export async function logEvent(type: BehaviorEventType, category: string, at: Date = new Date()): Promise<void> {
  const raw = await AsyncStorage.getItem(EVENTS_KEY)
  const events: BehaviorEvent[] = raw ? JSON.parse(raw) : []

  events.push({
    id: `${at.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    category,
    timestamp: at.toISOString(),
    dayOfWeek: at.getDay(),
    hourBucket: at.getHours(),
  })

  const trimmed = events.slice(-MAX_EVENTS)
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed))
}

export async function getEvents(): Promise<BehaviorEvent[]> {
  const raw = await AsyncStorage.getItem(EVENTS_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function recordLabel(patternKey: string, confirmed: boolean): Promise<void> {
  const raw = await AsyncStorage.getItem(LABELS_KEY)
  const labels: ConfirmationLabel[] = raw ? JSON.parse(raw) : []
  labels.push({ patternKey, confirmed, answeredAt: new Date().toISOString() })
  await AsyncStorage.setItem(LABELS_KEY, JSON.stringify(labels))
}

export async function getLabels(): Promise<ConfirmationLabel[]> {
  const raw = await AsyncStorage.getItem(LABELS_KEY)
  return raw ? JSON.parse(raw) : []
}
