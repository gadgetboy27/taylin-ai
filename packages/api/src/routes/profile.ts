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
    // Required from here on: routes/search.ts compares postcodes only within a
    // country, and suburb is the tightest rung of the local-first ladder.
    // Defaulted rather than optional so existing callers keep working while
    // everything captured from now on is complete.
    suburb: z.string().max(100).optional(),
    country: z.string().min(2).max(2).default('NZ'),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { addressText, postcode, city, suburb, country } = c.req.valid('json')

    // `.select()` so a zero-row match is detectable: PostgREST does not treat
    // "matched nothing" as an error, so without it this returned
    // { saved: true } while writing nothing. 018_user_provisioning.sql
    // guarantees the row exists, so no match now means something is genuinely
    // wrong — surface it rather than papering over it with an upsert.
    const { data, error } = await supabase
      .from('users')
      .update({ address_text: addressText ?? null, postcode, city, suburb: suburb ?? null, country })
      .eq('id', userId)
      .select('id')

    if (error) return c.json({ error: 'Failed to save address' }, 500)
    if (!data?.length) return c.json({ error: 'User not found' }, 404)
    return c.json({ saved: true })
  }
)
