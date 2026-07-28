import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { getForecast } from '../lib/weather.js'
import { supabase } from '../lib/supabase.js'

export const weatherRoute = new Hono()

// GET /weather?days=3 — forecast for wherever the buyer is.
//
// Coordinates come from the caller when they have them (the client already
// resolves its locality offline), otherwise from the saved profile. Nothing
// here stores a location: this is a read of where they already told us they are.
weatherRoute.get(
  '/',
  zValidator('query', z.object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    days: z.coerce.number().min(1).max(7).default(3),
  })),
  async (c) => {
    const userId = c.get('userId')
    let { lat, lng } = c.req.valid('query')
    const { days } = c.req.valid('query')

    if (lat === undefined || lng === undefined) {
      const { data } = await supabase
        .from('users').select('postcode, city, suburb').eq('id', userId).maybeSingle()
      if (!data?.postcode && !data?.suburb) {
        return c.json({ error: 'No location on file — tell me where you are first' }, 400)
      }
      // The client owns the locality table (it needs coordinates for the map
      // anyway), so ask it to send them rather than duplicating the table here
      // purely for this.
      return c.json({ error: 'Send lat and lng with the request' }, 400)
    }

    try {
      const forecast = await getForecast({ lat, lng, days })
      return c.json({ forecast })
    } catch (err) {
      console.error('[weather] forecast failed:', err)
      return c.json({ error: 'Could not get the forecast' }, 502)
    }
  }
)
