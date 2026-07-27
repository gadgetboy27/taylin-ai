import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'

export const profileRoute = new Hono()

profileRoute.post(
  '/address',
  zValidator('json', z.object({
    addressText: z.string().max(500).optional(),
    postcode: z.string().min(1).max(20),
    city: z.string().min(1).max(100),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { addressText, postcode, city } = c.req.valid('json')

    const { error } = await supabase
      .from('users')
      .update({ address_text: addressText ?? null, postcode, city })
      .eq('id', userId)

    if (error) return c.json({ error: 'Failed to save address' }, 500)
    return c.json({ saved: true })
  }
)
