/**
 * Global pattern-detection layer. Surfaces candidates worth confirming with
 * the user and records their answer as a label — never acts on a pattern
 * without asking first. Candidates above MAX_CONFIDENCE_TO_ASK are no longer
 * surfaced here; Phase 6's proactive-suggestion flow takes over from there.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getCandidatePatterns, type CandidatePattern } from '@/lib/patterns/detector'
import { recordLabel } from '@/lib/patterns/eventLog'
import { requestProactiveSuggestion } from '@/lib/suggestions-api'

interface PatternContextValue {
  pendingConfirmations: CandidatePattern[]
  confirm: (patternId: string, confirmed: boolean) => Promise<void>
  refresh: () => Promise<void>
}

const PatternContext = createContext<PatternContextValue | null>(null)

const MIN_CONFIDENCE_TO_ASK = 0.3
const MAX_CONFIDENCE_TO_ASK = 0.85

export function PatternProvider({ children }: { children: React.ReactNode }) {
  const [pendingConfirmations, setPendingConfirmations] = useState<CandidatePattern[]>([])
  // Tracks which high-confidence patterns already triggered a proactive
  // suggestion this session, so refresh() (called after every confirm/deny,
  // and whenever the app wants a re-check) doesn't re-send one per pattern
  // repeatedly. Session-only by design — see note below.
  const alreadySuggested = useRef<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const candidates = await getCandidatePatterns()

    setPendingConfirmations(
      candidates.filter((c) => c.confidence >= MIN_CONFIDENCE_TO_ASK && c.confidence < MAX_CONFIDENCE_TO_ASK)
    )

    // High enough confidence to act instead of asking again — this is the
    // "next time: are you feeling stressed again, want your song?" path.
    // Not persisted across app restarts; a restart re-sending one
    // already-fired suggestion is a much smaller cost than adding another
    // AsyncStorage key for this, and the backend has no dedup of its own
    // to lean on here since each request is independently valid.
    for (const candidate of candidates) {
      if (candidate.confidence < MAX_CONFIDENCE_TO_ASK) continue
      if (alreadySuggested.current.has(candidate.id)) continue
      alreadySuggested.current.add(candidate.id)
      requestProactiveSuggestion(candidate)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const confirm = useCallback(async (patternId: string, confirmed: boolean) => {
    await recordLabel(patternId, confirmed)
    setPendingConfirmations((prev) => prev.filter((c) => c.id !== patternId))
    await refresh()
  }, [refresh])

  return (
    <PatternContext.Provider value={{ pendingConfirmations, confirm, refresh }}>
      {children}
    </PatternContext.Provider>
  )
}

export function usePatterns() {
  const ctx = useContext(PatternContext)
  if (!ctx) throw new Error('usePatterns must be used inside PatternProvider')
  return ctx
}
