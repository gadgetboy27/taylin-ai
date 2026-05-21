import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import { TIER_CONFIG } from '../lib/tiers.js'
import { validateOrder } from '../middleware/validate.js'
import { recordSignal } from '../lib/preferences.js'

export const orderRoute = new Hono()

orderRoute.post('/', validateOrder, async (c) => {
  const userId = c.get('userId')
  const { searchId, productId, tokenId, amount } = c.req.valid('json')

  // Fetch product + seller info
  const { data: product } = await supabase
    .from('products')
    .select('*, sellers(id, trust_tier, stripe_connect_account_id)')
    .eq('id', productId)
    .single()

  if (!product) {
    return c.json({ error: 'Product not found' }, 404)
  }

  const tier = (product.sellers?.trust_tier ?? 2) as 1 | 2 | 3
  const tierConfig = TIER_CONFIG[tier]
  const platformFee = amount * (tierConfig.feePercent / 100)
  const escrowHeld = tierConfig.escrowRequired

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      seller_id: product.sellers?.id,
      product_id: productId,
      search_id: searchId,
      status: escrowHeld ? 'escrowed' : 'pending',
      amount,
      currency: product.currency ?? 'NZD',
      platform_fee: platformFee,
      stripe_token_id: tokenId,
      escrow_held: escrowHeld,
      escrow_release_at: escrowHeld
        ? new Date(Date.now() + (tierConfig.autoReleaseHours ?? 48) * 3600000).toISOString()
        : null,
    })
    .select('id')
    .single()

  if (error || !order) {
    return c.json({ error: 'Failed to create order' }, 500)
  }

  // Purchase is the strongest positive signal — update preferences in background
  const category = (product as { category?: string }).category ?? 'retail'
  recordSignal(userId, category, product, 'purchase').catch((err) =>
    console.error('[preferences] purchase signal failed:', err)
  )

  return c.json({ orderId: order.id, status: escrowHeld ? 'escrowed' : 'pending' })
})
