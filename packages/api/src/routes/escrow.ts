import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'

export const escrowRoute = new Hono()

// Buyer confirms delivery — releases escrow for tier 3
escrowRoute.post(
  '/confirm/:orderId',
  zValidator('param', z.object({ orderId: z.string().uuid() })),
  async (c) => {
    const userId = c.get('userId')
    const { orderId } = c.req.valid('param')

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        buyer_confirmed_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('user_id', userId)
      .eq('escrow_held', true)

    if (error) return c.json({ error: 'Failed to confirm delivery' }, 500)
    return c.json({ ok: true, status: 'delivered' })
  }
)

// Buyer raises a dispute
escrowRoute.post(
  '/dispute/:orderId',
  zValidator('param', z.object({ orderId: z.string().uuid() })),
  async (c) => {
    const userId = c.get('userId')
    const { orderId } = c.req.valid('param')

    const { error } = await supabase
      .from('orders')
      .update({ status: 'disputed' })
      .eq('id', orderId)
      .eq('user_id', userId)

    if (error) return c.json({ error: 'Failed to open dispute' }, 500)
    return c.json({ ok: true, status: 'disputed' })
  }
)

// Cron job target — auto-release escrowed orders past their release date
escrowRoute.post('/auto-release', async (c) => {
  // This endpoint should only be called from Railway cron, not public
  const cronSecret = c.req.header('X-Cron-Secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'escrowed')
    .lte('escrow_release_at', new Date().toISOString())

  if (!orders || orders.length === 0) return c.json({ released: 0 })

  const { error } = await supabase
    .from('orders')
    .update({ status: 'released' })
    .in('id', orders.map((o) => o.id))

  if (error) return c.json({ error: 'Auto-release failed' }, 500)
  return c.json({ released: orders.length })
})
