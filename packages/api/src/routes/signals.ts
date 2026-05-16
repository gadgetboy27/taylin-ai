import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import { validateSignal } from '../middleware/validate.js'
import { searchFlights } from '../lib/amadeus.js'

export const signalsRoute = new Hono()

// Create a buy signal monitor
signalsRoute.post('/', validateSignal, async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const { data, error } = await supabase
    .from('monitors')
    .insert({
      user_id: userId,
      search_id: body.searchId,
      monitor_type: body.monitorType,
      target_price: body.targetPrice,
      route: body.route,
      check_interval_hours: body.checkIntervalHours,
    })
    .select('id')
    .single()

  if (error || !data) return c.json({ error: 'Failed to create monitor' }, 500)
  return c.json({ monitorId: data.id }, 201)
})

// List active monitors for the user
signalsRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const { data } = await supabase
    .from('monitors')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })

  return c.json({ monitors: data ?? [] })
})

// Cron job — run all active monitors (called from Railway cron every 4h)
signalsRoute.post('/run', async (c) => {
  const cronSecret = c.req.header('X-Cron-Secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const staleThreshold = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

  const { data: monitors } = await supabase
    .from('monitors')
    .select('*, searches(parsed_brief)')
    .eq('active', true)
    .or(`last_checked.is.null,last_checked.lt.${staleThreshold}`)

  let triggered = 0

  for (const monitor of monitors ?? []) {
    await supabase
      .from('monitors')
      .update({ last_checked: new Date().toISOString() })
      .eq('id', monitor.id)

    if (monitor.monitor_type === 'price_drop' && monitor.target_price) {
      const brief = monitor.searches?.parsed_brief as {
        category: string
        searchTerms: string[]
      } | null

      if (!brief) continue

      let currentBestPrice: number | null = null

      if (brief.category === 'flights' && brief.searchTerms.length >= 2) {
        const results = await searchFlights({
          origin: brief.searchTerms[0],
          destination: brief.searchTerms[1],
          date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        }).catch(() => [])

        const first = results[0] as { price?: number } | undefined
        currentBestPrice = first?.price ?? null
      } else {
        const { data: product } = await supabase
          .from('products')
          .select('price')
          .ilike('name', `%${brief.searchTerms[0]}%`)
          .eq('stock_available', true)
          .order('price')
          .limit(1)
          .single()

        currentBestPrice = product?.price ?? null
      }

      if (currentBestPrice != null && currentBestPrice <= monitor.target_price) {
        // Signal fired — in production, send push via OneSignal here
        await supabase
          .from('monitors')
          .update({ triggered_at: new Date().toISOString(), active: false })
          .eq('id', monitor.id)

        triggered++
      }
    }
  }

  return c.json({ processed: (monitors ?? []).length, triggered })
})
