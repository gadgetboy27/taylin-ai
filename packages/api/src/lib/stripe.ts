import Stripe from 'stripe'

const stripeKey = process.env.STRIPE_SECRET_KEY

if (!stripeKey) {
  console.warn('[stripe] STRIPE_SECRET_KEY not set — payment features disabled')
}

export const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia', typescript: true })
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
