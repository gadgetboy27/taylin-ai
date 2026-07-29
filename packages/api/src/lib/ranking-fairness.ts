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

/**
 * Eligible for a reserved slot.
 *
 * Trust tier is deliberately NOT part of this. Tier is the verification axis;
 * status is the enforcement axis, and "should this seller be visible" is an
 * enforcement question that sellerStatus already answers — seller-fraud.ts
 * moves bad actors to flagged/suspended. Gating on tier as well meant a real
 * local business with a verified website and NZBN was excluded from the floor
 * written to protect exactly that seller, because tier 1 needs >10 orders
 * (unreachable when new) and tier 2 needs identity verification they may not
 * have done yet.
 *
 * The financial risk that gate appeared to cover is already covered better
 * elsewhere: lib/tiers.ts makes tier 3 the most protected transaction on the
 * platform — escrow required, buyer confirmation required, 7-day auto-release.
 * An unverified seller cannot take a buyer's money and vanish.
 */
function isQualifyingLocal(entry: RelevanceEntry, topHalfCutoff: number): boolean {
  const c = entry.item as Candidate
  return (
    c.origin === 'internal' &&
    c.sellerStatus === 'active' &&
    entry.relevanceRank < topHalfCutoff
  )
}

/** Verified sellers get first refusal on the reserved slots — see below. */
function isVerified(entry: RelevanceEntry): boolean {
  const c = entry.item as Candidate
  return c.trustTier === 1 || c.trustTier === 2
}

/**
 * Order candidates for promotion: verified first, then by relevance within
 * each group.
 *
 * This is what keeps verification worth doing now that it no longer gates
 * visibility outright. A verified seller takes the first reserved slot ahead of
 * an unverified one, so verifying buys priority — but an unverified local
 * seller is never shut out, which is the outcome the floor exists for.
 */
function promotionOrder(a: RelevanceEntry, b: RelevanceEntry): number {
  const av = isVerified(a) ? 0 : 1
  const bv = isVerified(b) ? 0 : 1
  return av !== bv ? av - bv : a.relevanceRank - b.relevanceRank
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

  const qualifyingLocalsOutsideTopN = relevanceOrder
    .filter((entry) => !inTopN.has(entry) && isQualifyingLocal(entry, topHalfCutoff))
    .sort(promotionOrder)

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
