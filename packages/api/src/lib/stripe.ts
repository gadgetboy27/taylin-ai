import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY env var')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
})

// Issue a single-use scoped card token for one transaction.
// The buyer's real card never reaches the merchant.
export async function issueTransactionToken(params: {
  customerId: string
  amountCents: number
  currency: string
  metadata?: Record<string, string>
}): Promise<string> {
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
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}
