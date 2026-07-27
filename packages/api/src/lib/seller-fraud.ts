// Seller-side KYC/removal enforcement. Distinct from lib/fraud.ts, which
// checks a BUYER's spend limits before issuing a payment token — this file
// evaluates whether a SELLER's trust signals warrant flagging, suspension,
// or (admin-only) banning.

import { supabase } from './supabase.js'

export type SellerStatus = 'active' | 'flagged' | 'suspended' | 'banned'

const STATUS_SEVERITY: Record<SellerStatus, number> = {
  active: 0,
  flagged: 1,
  suspended: 2,
  banned: 3,
}

export type FraudSignals = {
  disputeRate: number
  // null = no NZBN on file / not checked. false = lookup shows the business
  // is no longer active (deregistered, struck off, etc).
  nzbnStillActive: boolean | null
  // A web-verify check (URL/search) that previously succeeded now fails.
  webVerifyRegressed: boolean
}

export type FraudEvaluation = {
  reason: string
  proposedStatus: 'flagged' | 'suspended'
}

/**
 * Evaluates whether a seller's current signals cross a fraud/removal
 * threshold. Only ever proposes moving to a STRICTER status than the
 * seller's current one — it never loosens (suspended -> active) and never
 * proposes 'banned', since a ban is always a manual admin decision. Callers
 * are responsible for persisting the transition and appending to
 * sellers.flags; this function is pure and makes no DB calls.
 *
 * Returns null when no new threshold is crossed.
 */
export function evaluateForRemoval(
  currentStatus: SellerStatus,
  signals: FraudSignals
): FraudEvaluation | null {
  if (currentStatus === 'banned') return null

  let proposed: FraudEvaluation | null = null

  if (signals.nzbnStillActive === false) {
    proposed = {
      reason: 'NZBN lookup shows the business is no longer registered/active',
      proposedStatus: 'suspended',
    }
  } else if (signals.disputeRate >= 0.15) {
    proposed = {
      reason: `Dispute rate ${(signals.disputeRate * 100).toFixed(1)}% exceeds the suspension threshold (15%)`,
      proposedStatus: 'suspended',
    }
  } else if (signals.webVerifyRegressed) {
    proposed = {
      reason: 'A web verification that previously passed now fails on re-check',
      proposedStatus: 'flagged',
    }
  } else if (signals.disputeRate >= 0.05) {
    proposed = {
      reason: `Dispute rate ${(signals.disputeRate * 100).toFixed(1)}% exceeds the flag threshold (5%)`,
      proposedStatus: 'flagged',
    }
  }

  if (!proposed) return null
  if (STATUS_SEVERITY[proposed.proposedStatus] <= STATUS_SEVERITY[currentStatus]) return null

  return proposed
}

export type FlagEntry = {
  reason: string
  triggeredAt: string
  action: 'flagged' | 'suspended' | 'resolved'
  resolvedAt?: string
  resolution?: 'cleared' | 'suspended' | 'banned'
}

// Reads a seller's current signals, evaluates them, and persists a stricter
// status + audit entry if a threshold is newly crossed. No-op if nothing
// changed. This is the one place status actually gets written by the
// automated side of enforcement — admin resolution (routes/admin/sellers.ts)
// is the only other writer, and is the only way to loosen a status.
export async function runFraudEvaluation(sellerId: string): Promise<FraudEvaluation | null> {
  const { data: seller } = await supabase
    .from('sellers')
    .select('status, dispute_rate, nzbn, flags')
    .eq('id', sellerId)
    .single()

  if (!seller) return null

  // NZBN re-check is intentionally out of scope here — nzbn.ts already does
  // the lookup during onboarding; wiring a re-check trigger is a follow-up.
  const signals: FraudSignals = {
    disputeRate: seller.dispute_rate,
    nzbnStillActive: null,
    webVerifyRegressed: false,
  }

  const evaluation = evaluateForRemoval(seller.status as SellerStatus, signals)
  if (!evaluation) return null

  const flagEntry: FlagEntry = {
    reason: evaluation.reason,
    triggeredAt: new Date().toISOString(),
    action: evaluation.proposedStatus,
  }

  await supabase
    .from('sellers')
    .update({
      status: evaluation.proposedStatus,
      flags: [...(seller.flags as FlagEntry[]), flagEntry],
    })
    .eq('id', sellerId)

  return evaluation
}
