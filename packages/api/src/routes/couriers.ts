import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'
import { authMiddleware } from '../middleware/auth.js'
import { registerTracking } from '../lib/trackingmore.js'

export const couriersRoute = new Hono()

// ── Public: curated courier directory ─────────────────────────────────────────
couriersRoute.get('/', async (c) => {
  const { data } = await supabase
    .from('couriers')
    .select('id, name, contact_info, service_area, total_deliveries, avg_rating')
    .order('avg_rating', { ascending: false })

  return c.json({ couriers: data ?? [] })
})

// ── Seller: "I can't deliver myself" — assign a courier + tracking number ────
couriersRoute.post(
  '/assign/:orderId',
  authMiddleware,
  zValidator('json', z.object({
    courierId: z.string().uuid(),
    trackingNumber: z.string().min(1).max(100),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { orderId } = c.req.param()
    const { courierId, trackingNumber } = c.req.valid('json')

    // Confirm the requesting user owns the seller on this order.
    const { data: order } = await supabase
      .from('orders')
      .select('id, seller_id, sellers!inner(owner_user_id)')
      .eq('id', orderId)
      .eq('sellers.owner_user_id', userId)
      .single()

    if (!order) return c.json({ error: 'Order not found for this seller' }, 404)

    const { data: courier } = await supabase
      .from('couriers')
      .select('id, trackingmore_carrier_code')
      .eq('id', courierId)
      .single()

    if (!courier) return c.json({ error: 'Courier not found' }, 404)

    await supabase
      .from('orders')
      .update({ courier_id: courierId, tracking_number: trackingNumber, tracking_provider: courier.trackingmore_carrier_code, status: 'shipped' })
      .eq('id', orderId)

    if (courier.trackingmore_carrier_code) {
      registerTracking(trackingNumber, courier.trackingmore_carrier_code).catch((err) =>
        console.error('[trackingmore] registration failed:', err)
      )
    }

    return c.json({ assigned: true })
  }
)

// ── TrackingMore webhook: delivery status changed ─────────────────────────────
// NOTE: this does not yet verify TrackingMore's webhook signature — that
// needs to be added from their current docs before relying on this in
// production. For now it's shaped defensively (looks up by tracking number,
// ignores anything that doesn't match) rather than trusting the payload.
couriersRoute.post('/webhook/trackingmore', async (c) => {
  const body = await c.req.json().catch(() => null) as {
    data?: { tracking_number?: string; delivery_status?: string }
  } | null

  const trackingNumber = body?.data?.tracking_number
  const deliveryStatus = body?.data?.delivery_status
  if (!trackingNumber || !deliveryStatus) return c.json({ error: 'Malformed payload' }, 400)

  // Informational only — does not touch order.status or trigger escrow
  // release. Buyer-confirms-receipt + the existing timeout remain the only
  // things that release escrow (see escrow.ts); this is surfaced in the app
  // as a tracking-status hint, nothing more.
  await supabase
    .from('orders')
    .update({ tracking_status_hint: deliveryStatus })
    .eq('tracking_number', trackingNumber)

  return c.json({ received: true })
})

// ── Post-delivery rating — updates the aggregate, not a per-review table ─────
couriersRoute.post(
  '/:id/rate',
  authMiddleware,
  zValidator('json', z.object({ rating: z.number().int().min(1).max(5) })),
  async (c) => {
    const { id } = c.req.param()
    const { rating } = c.req.valid('json')

    const { data: courier } = await supabase
      .from('couriers')
      .select('total_deliveries, rating_sum')
      .eq('id', id)
      .single()

    if (!courier) return c.json({ error: 'Courier not found' }, 404)

    const totalDeliveries = courier.total_deliveries + 1
    const ratingSum = courier.rating_sum + rating

    // Optimistic lock (same pattern as deals.ts claim) — if a concurrent
    // rating already changed these counters, this matches zero rows rather
    // than erroring, so check the returned rows and ask the caller to retry.
    const { data: updated, error } = await supabase
      .from('couriers')
      .update({
        total_deliveries: totalDeliveries,
        rating_sum: ratingSum,
        avg_rating: Math.round((ratingSum / totalDeliveries) * 100) / 100,
      })
      .eq('id', id)
      .eq('total_deliveries', courier.total_deliveries)
      .eq('rating_sum', courier.rating_sum)
      .select('id')

    if (error || !updated?.length) return c.json({ error: 'Failed to record rating — try again' }, 409)
    return c.json({ rated: true })
  }
)
