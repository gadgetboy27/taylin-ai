import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { notifyForDeal, shouldExpandTier, nextTier, type RadiusTier } from '../lib/broadcast.js'

export const dealsRoute = new Hono()

// Auth applied per-route (not via a blanket index.ts path prefix) since this
// sub-app mixes a public GET (buyer feed) with mutations that must be
// authenticated — an unauthenticated claim endpoint would let anyone
// script-decrement a competitor's inventory with no purchase happening.

// ── Seller: create a deal ─────────────────────────────────────────────────────
dealsRoute.post(
  '/',
  authMiddleware,
  zValidator('json', z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    price: z.number().min(0),
    quantity: z.number().int().min(1),
    expiresAt: z.string().datetime(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const body = c.req.valid('json')

    const { data: seller } = await supabase
      .from('sellers')
      .select('id, status')
      .eq('owner_user_id', userId)
      .single()

    if (!seller) return c.json({ error: 'No seller profile for this account' }, 404)
    if (seller.status !== 'active') return c.json({ error: 'Seller account is not active' }, 403)

    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        seller_id: seller.id,
        title: body.title,
        description: body.description ?? null,
        price: body.price,
        quantity_original: body.quantity,
        quantity_remaining: body.quantity,
        expires_at: body.expiresAt,
      })
      .select('id')
      .single()

    if (error) return c.json({ error: 'Failed to create deal' }, 500)

    // Fire and forget — notify local-tier buyers now, don't make the seller
    // wait on a push-delivery round trip to see their deal posted.
    notifyForDeal(deal.id).catch((err) => console.error('[broadcast] initial notify failed:', err))

    return c.json({ dealId: deal.id }, 201)
  }
)

// ── Buyer: feed of active deals ───────────────────────────────────────────────
dealsRoute.get('/', async (c) => {
  const { data } = await supabase
    .from('deals')
    .select('id, title, description, price, currency, quantity_remaining, expires_at, sellers(business_name, city)')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .gt('quantity_remaining', 0)
    .order('created_at', { ascending: false })
    .limit(50)

  return c.json({ deals: data ?? [] })
})

// ── Buyer: claim one unit of a deal ───────────────────────────────────────────
dealsRoute.post('/:id/claim', authMiddleware, async (c) => {
  const { id } = c.req.param()

  const { data: deal } = await supabase
    .from('deals')
    .select('quantity_remaining, status')
    .eq('id', id)
    .single()

  if (!deal) return c.json({ error: 'Deal not found' }, 404)
  if (deal.status !== 'active' || deal.quantity_remaining <= 0) {
    return c.json({ error: 'Deal is no longer available' }, 409)
  }

  const remaining = deal.quantity_remaining - 1
  // Optimistic lock via the .eq('quantity_remaining', ...) clause — if a
  // concurrent claim already changed the row, this matches zero rows rather
  // than erroring, so check the returned rows, not just `error`.
  const { data: updated, error } = await supabase
    .from('deals')
    .update({
      quantity_remaining: remaining,
      status: remaining === 0 ? 'sold_out' : 'active',
    })
    .eq('id', id)
    .eq('quantity_remaining', deal.quantity_remaining)
    .select('quantity_remaining')

  if (error || !updated?.length) return c.json({ error: 'Failed to claim — try again' }, 409)
  return c.json({ claimed: true, remaining })
})

// ── Cron: re-evaluate active deals, expand broadcast reach if warranted ──────
// Called from Railway cron (same X-Cron-Secret pattern as signals.ts /run
// and escrow.ts /auto-release) — every ~2h.
dealsRoute.post('/broadcast-tick', async (c) => {
  const cronSecret = c.req.header('X-Cron-Secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { data: activeDeals } = await supabase
    .from('deals')
    .select('id, quantity_remaining, quantity_original, expires_at, created_at, broadcast_radius_tier')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())

  let expanded = 0
  let notified = 0

  for (const deal of activeDeals ?? []) {
    // Re-notify the current tier first — new buyers may have joined it
    // (e.g. just set their postcode) since the last tick.
    const result = await notifyForDeal(deal.id)
    notified += result.newlyNotified

    if (shouldExpandTier(deal)) {
      const next = nextTier(deal.broadcast_radius_tier as RadiusTier)
      if (next) {
        await supabase.from('deals').update({ broadcast_radius_tier: next }).eq('id', deal.id)
        expanded++
      }
    }
  }

  return c.json({ processed: (activeDeals ?? []).length, expanded, notified })
})
