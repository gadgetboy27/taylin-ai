/**
 * The privacy boundary. PatternSummary is the ONLY shape any network-calling
 * code may pass when asking Claude to phrase a proactive suggestion — no
 * names, no exact timestamps, no location, no device identifiers, and no
 * raw event/candidate objects.
 *
 * This is enforced at the type level, not just by convention: PatternSummary
 * carries a brand keyed by a symbol that is not exported from this module.
 * No object literal written anywhere else can satisfy that brand, so
 * toPatternSummary() below is structurally the only way to produce a value
 * TypeScript will accept as a PatternSummary — a raw CandidatePattern or
 * BehaviorEvent cannot be smuggled across the boundary by mistake, because
 * it simply won't type-check. (The brand is a symbol key, which
 * JSON.stringify silently omits, so it never appears in the actual network
 * payload either.)
 */
import type { CandidatePattern } from './detector'

const patternSummaryBrand: unique symbol = Symbol('PatternSummary')

export type PatternSummary = {
  readonly [patternSummaryBrand]: true
  pattern_type: 'recurring_purchase' | 'biometric_deviation'
  category: string
  day_of_week: string
  time_window: string
  confidence: number
  streak_or_confirmations: number
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function roundedTimeWindow(hourBucket: number): string {
  const start = hourBucket.toString().padStart(2, '0')
  const end = ((hourBucket + 1) % 24).toString().padStart(2, '0')
  return `${start}:00-${end}:00`
}

export function toPatternSummary(candidate: CandidatePattern): PatternSummary {
  return {
    [patternSummaryBrand]: true,
    pattern_type: candidate.type,
    category: candidate.category,
    day_of_week: DAY_NAMES[candidate.dayOfWeek],
    time_window: roundedTimeWindow(candidate.hourBucket),
    confidence: Math.round(candidate.confidence * 100) / 100,
    streak_or_confirmations: candidate.streak,
  }
}
