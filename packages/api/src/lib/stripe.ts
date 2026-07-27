import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY

if (!stripeKey) {
  console.warn('[stripe] STRIPE_SECRET_KEY not set — payment features disabled')
}

export const stripe = stripeKey
  // Must match the API version the installed SDK is generated against —
  // the type is a single literal, so a stale value fails the build.
  ? new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia', typescript: true })
  : null

// Issue a single-use scoped card token for one transaction.
// The buyer's real card never reaches the merchant.
export async function issueTransactionToken(params: {
  customerId: string
  amountCents: number
  currency: string
  metadata?: Record<string, string>
}): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured — add STRIPE_SECRET_KEY to packages/api/.env')
  const card = await stripe.issuing.cards.create({
    currency: params.currency,
    type: 'virtual',
    cardholder: params.customerId,
    spending_controls: {
      spending_limits: [
        {
          amount: params.amountCents,
          interval: 'per_authorization',
        },
      ],
    },
    metadata: params.metadata ?? {},
  })

  return card.id
}

// ── Connect: payouts, and the identity check that comes with them ────────────
//
// Sellers need a Connect account to be paid at all, and Stripe verifies the
// person during onboarding — legal name, DOB, address, government ID, bank
// ownership — as regulated KYC carried out by a licensed provider. That is a
// stronger identity claim than anything this app could collect itself, and it
// costs the seller nothing extra since they have to do it regardless.
//
// It matters most for sellers with no NZBN: an unregistered sole trader can
// clear Stripe's checks even though the business register has never heard of
// them, so identity stops depending on being a registered company.

export async function createConnectAccount(params: {
  email: string
  businessName: string
}): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured')
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'NZ',
    email: params.email,
    business_profile: { name: params.businessName },
    capabilities: { transfers: { requested: true } },
  })
  return account.id
}

export async function createOnboardingLink(params: {
  accountId: string
  refreshUrl: string
  returnUrl: string
}): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured')
  const link = await stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: 'account_onboarding',
  })
  return link.url
}

export type ConnectStatus = {
  /** Stripe has verified the person behind the account. */
  identityVerified: boolean
  payoutsEnabled: boolean
  /** Requirements still outstanding, for showing the seller what's missing. */
  outstanding: string[]
}

export async function getConnectStatus(accountId: string): Promise<ConnectStatus> {
  if (!stripe) throw new Error('Stripe not configured')
  const account = await stripe.accounts.retrieve(accountId)

  // payouts_enabled is the honest signal: Stripe only turns it on once its
  // verification actually passed. individual.verification.status alone can read
  // 'verified' on an account still blocked for other reasons.
  const outstanding = account.requirements?.currently_due ?? []

  return {
    identityVerified: account.payouts_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    outstanding,
  }
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<Stripe.Event> {
  if (!stripe) throw new Error('Stripe not configured')
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}
