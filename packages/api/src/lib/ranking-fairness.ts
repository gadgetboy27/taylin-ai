// Deterministic post-processing applied AFTER rankResults() returns its full
// relevance-ordered list. Guarantees a fixed number of top-10 slots go to
// unpaid, relevance-qualified local sellers — a big-brand paid boost (when
// that exists) can reorder the remaining slots, but cannot displace these.
//
// Kept separate from the LLM ranking step on purpose: a fairness GUARANTEE
// needs to be deterministic and auditable, not something we hope an LLM
// prompt reliably honors.

export const RESULT_LIMIT = 10
export const FLOOR_SLOTS = 2

type Candidate = {
  origin?: 'internal' | 'external'
  sellerStatus?: 'active' | 'flagged' | 'suspended' | 'banned'
  trustTier?: 1 | 2 | 3
}

type RelevanceEntry = {
  item: unknown
  summary: string
  relevanceRank: number
}

function isQualifyingLocal(entry: RelevanceEntry, topHalfCutoff: number): boolean {
  const c = entry.item as Candidate
  return (
    c.origin === 'internal' &&
    c.sellerStatus === 'active' &&
    (c.trustTier === 1 || c.trustTier === 2) &&
    entry.relevanceRank < topHalfCutoff
  )
}

/**
 * `ranked`/`summaries` are the full (untruncated) output of rankResults().
 * Returns exactly RESULT_LIMIT items (or fewer if there aren't enough
 * candidates), with FLOOR_SLOTS reserved for qualifying local sellers when
 * any exist — and no padding/collapse weirdness when none do.
 */
export function applyLocalSellerFloor(
  ranked: unknown[],
  summaries: Record<string, string>
): { ranked: unknown[]; summaries: Record<string, string> } {
  const relevanceOrder: RelevanceEntry[] = ranked.map((item, i) => ({
    item,
    summary: summaries[String(i)] ?? '',
    relevanceRank: i,
  }))

  // "Minimum relevance bar" — a local seller ranked in the bottom half by
  // relevance doesn't qualify for a floor slot just for existing; this is
  // what stops an irrelevant local listing from gaming the guarantee.
  const topHalfCutoff = Math.ceil(relevanceOrder.length / 2)

  const initialTopN = relevanceOrder.slice(0, RESULT_LIMIT)
  const inTopN = new Set(initialTopN)

  const qualifyingLocalsOutsideTopN = relevanceOrder.filter(
    (entry) => !inTopN.has(entry) && isQualifyingLocal(entry, topHalfCutoff)
  )

  const alreadyLocalInTopN = initialTopN.filter((e) => isQualifyingLocal(e, topHalfCutoff)).length
  const slotsNeeded = Math.max(0, FLOOR_SLOTS - alreadyLocalInTopN)
  const toPromote = qualifyingLocalsOutsideTopN.slice(0, slotsNeeded)

  let finalTopN = initialTopN
  if (toPromote.length > 0) {
    // Evict the lowest-relevance non-local entries first — never evict an
    // already-qualifying local to make room for another.
    const evictionCandidates = [...initialTopN]
      .reverse()
      .filter((e) => !isQualifyingLocal(e, topHalfCutoff))
    const toEvict = new Set(evictionCandidates.slice(0, toPromote.length))
    finalTopN = [...initialTopN.filter((e) => !toEvict.has(e)), ...toPromote]
  }

  const newSummaries: Record<string, string> = {}
  const newRanked = finalTopN.map((entry, i) => {
    newSummaries[String(i)] = entry.summary
    return entry.item
  })

  return { ranked: newRanked, summaries: newSummaries }
}
