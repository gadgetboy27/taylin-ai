/**
 * SafeSend Escrow Integration
 *
 * taylin.ai uses your existing SafeSend app for all escrow operations
 * instead of building a separate escrow system.
 *
 * TO WIRE THIS UP:
 * 1. Set EXPO_PUBLIC_SAFESEND_API_URL in your .env
 * 2. Get your SafeSend API key and set SAFESEND_API_KEY in packages/api/.env
 * 3. Replace the stub functions below with real SafeSend API calls
 *
 * SafeSend handles:
 * - Holding funds until delivery confirmed
 * - Dispute resolution
 * - Auto-release after timeout
 * - P2P protection (tier 3 sellers)
 *
 * Docs: refer to your SafeSend app's API routes
 */

const SAFESEND_URL = process.env.EXPO_PUBLIC_SAFESEND_API_URL

export type SafeSendEscrowParams = {
  buyerId: string
  sellerId: string
  amount: number
  currency: string
  orderId: string
  releaseAfterHours: number
}

export type SafeSendEscrowResult = {
  escrowId: string
  status: 'held' | 'released' | 'disputed' | 'refunded'
  releaseAt: string
}

// ─── STUB — replace with real SafeSend API call ───────────────────────────────
export async function createEscrow(
  params: SafeSendEscrowParams,
  authToken: string
): Promise<SafeSendEscrowResult> {
  if (!SAFESEND_URL) {
    // Return a mock result so the app doesn't crash during dev
    return {
      escrowId: `mock-escrow-${params.orderId}`,
      status: 'held',
      releaseAt: new Date(Date.now() + params.releaseAfterHours * 3600000).toISOString(),
    }
  }

  const res = await fetch(`${SAFESEND_URL}/escrow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) throw new Error('SafeSend escrow creation failed')
  return res.json() as Promise<SafeSendEscrowResult>
}

// ─── STUB — replace with real SafeSend API call ───────────────────────────────
export async function releaseEscrow(
  escrowId: string,
  authToken: string
): Promise<void> {
  if (!SAFESEND_URL) return

  await fetch(`${SAFESEND_URL}/escrow/${escrowId}/release`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
  })
}

// ─── STUB — replace with real SafeSend API call ───────────────────────────────
export async function disputeEscrow(
  escrowId: string,
  reason: string,
  authToken: string
): Promise<void> {
  if (!SAFESEND_URL) return

  await fetch(`${SAFESEND_URL}/escrow/${escrowId}/dispute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ reason }),
  })
}
