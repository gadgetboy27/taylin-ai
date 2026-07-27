import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'
import { phraseSuggestion } from '../lib/ai-wrapper.js'
import { sendNotification } from '../lib/push.js'

export const suggestionsRoute = new Hono()

// Matches apps/mobile/lib/patterns/boundary.ts's PatternSummary exactly.
// .strict() rejects any request carrying fields beyond this shape — this is
// the server-side half of the privacy boundary: even if a client bug
// somehow constructed a bad payload, the API refuses anything outside this
// de-identified shape rather than silently accepting extra fields.
const patternSummarySchema = z.object({
  pattern_type: z.enum(['recurring_purchase', 'biometric_deviation']),
  category: z.string().min(1).max(200),
  day_of_week: z.string().min(1).max(20),
  time_window: z.string().min(1).max(20),
  confidence: z.number().min(0).max(1),
  streak_or_confirmations: z.number().int().min(0),
}).strict()

suggestionsRoute.post('/', zValidator('json', patternSummarySchema), async (c) => {
  const userId = c.get('userId')
  const pattern = c.req.valid('json')

  const message = await phraseSuggestion(pattern)

  let matchedProduct: { id: string; name: string; price: number } | null = null

  if (pattern.pattern_type === 'recurring_purchase') {
    // Only surface an active, floor-eligible (tier 1/2) local seller — never
    // a flagged/suspended/banned one, and never tier-3 P2P for an unsolicited offer.
    const { data } = await supabase
      .from('products')
      .select('id, name, price, sellers!inner(trust_tier, status)')
      .eq('sellers.status', 'active')
      .in('sellers.trust_tier', [1, 2])
      .ilike('category', `%${pattern.category}%`)
      .eq('stock_available', true)
      .limit(1)
      .maybeSingle()

    if (data) matchedProduct = { id: data.id, name: data.name, price: data.price }
  }

  const { notificationId } = await sendNotification({
    userId,
    title: pattern.pattern_type === 'biometric_deviation' ? 'Checking in' : 'A suggestion for you',
    body: message,
    data: matchedProduct ? { productId: matchedProduct.id } : {},
  })

  return c.json({ sent: true, notificationId, message, matchedProduct })
})
