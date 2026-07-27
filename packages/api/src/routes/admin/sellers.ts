import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../../lib/supabase.js'
import { runFraudEvaluation, type FlagEntry } from '../../lib/seller-fraud.js'

export const adminSellersRoute = new Hono()

// ── Review queue: sellers currently flagged or suspended ─────────────────────
adminSellersRoute.get('/flagged', async (c) => {
  const { data } = await supabase
    .from('sellers')
    .select('id, business_name, status, dispute_rate, trust_tier, flags')
    .in('status', ['flagged', 'suspended'])
    .order('status')

  return c.json({ sellers: data ?? [] })
})

// ── Re-run the automated evaluator for one seller ─────────────────────────────
adminSellersRoute.post('/:id/evaluate', async (c) => {
  const { id } = c.req.param()
  const result = await runFraudEvaluation(id)
  return c.json({ evaluated: true, transition: result })
})

// ── Admin resolves a flagged/suspended seller — the only way to loosen status
adminSellersRoute.post(
  '/:id/resolve',
  zValidator('json', z.object({
    resolution: z.enum(['cleared', 'suspended', 'banned']),
    note: z.string().max(1000).optional(),
  })),
  async (c) => {
    const { id } = c.req.param()
    const { resolution, note } = c.req.valid('json')

    const { data: seller } = await supabase
      .from('sellers')
      .select('status, flags')
      .eq('id', id)
      .single()

    if (!seller) return c.json({ error: 'Seller not found' }, 404)

    const newStatus = resolution === 'cleared' ? 'active' : resolution

    const flagEntry: FlagEntry = {
      reason: note ?? `Admin resolved as ${resolution}`,
      triggeredAt: new Date().toISOString(),
      action: 'resolved',
      resolvedAt: new Date().toISOString(),
      resolution,
    }

    const { error } = await supabase
      .from('sellers')
      .update({
        status: newStatus,
        flags: [...(seller.flags as FlagEntry[]), flagEntry],
      })
      .eq('id', id)

    if (error) return c.json({ error: 'Failed to resolve' }, 500)
    return c.json({ status: newStatus })
  }
)
