import { supabase } from './supabase'
import { toPatternSummary } from './patterns/boundary'
import type { CandidatePattern } from './patterns/detector'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

// toPatternSummary() is the only way to produce the payload this sends —
// see boundary.ts for why that's a type-level guarantee, not a convention.
export async function requestProactiveSuggestion(candidate: CandidatePattern): Promise<void> {
  const summary = toPatternSummary(candidate)

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  await fetch(`${API_URL}/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(summary),
  }).catch(() => {
    // Best-effort — a failed proactive suggestion just means the user
    // doesn't get this one nudge; nothing to recover or retry aggressively.
  })
}
