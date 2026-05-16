import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import { issueTransactionToken } from '../lib/stripe.js'
import { runFraudChecks } from '../lib/fraud.js'
import { validateToken } from '../middleware/validate.js'

export const tokenRoute = new Hono()

tokenRoute.post('/', validateToken, async (c) => {
  const userId = c.get('userId')
  const { amount, searchId } = c.req.valid('json')

  const fraudResult = await runFraudChecks({ userId, amount, sellerId: '' })
  if (!fraudResult.pass) {
    return c.json({ error: fraudResult.reason ?? 'Payment declined' }, 402)
  }

  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (!user?.stripe_customer_id) {
    return c.json({ error: 'Stripe customer not set up' }, 400)
  }

  const amountCents = Math.round(amount * 100)

  const tokenId = await issueTransactionToken({
    customerId: user.stripe_customer_id,
    amountCents,
    currency: 'nzd',
    metadata: { userId, searchId },
  })

  return c.json({ tokenId })
})
