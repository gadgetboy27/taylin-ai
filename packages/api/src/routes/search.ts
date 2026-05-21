import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'
import { rankResults } from '../lib/ai-wrapper.js'
import { searchFlights } from '../lib/amadeus.js'
import { searchTrademe, searchTrademeMotors, isTrademeconfigured } from '../lib/trademe.js'
import { searchEbay, isEbayConfigured } from '../lib/ebay.js'
import { searchWeb, isWebSearchConfigured } from '../lib/web-search.js'

export const searchRoute = new Hono()

searchRoute.get('/:searchId', zValidator('param', z.object({ searchId: z.string().uuid() })), async (c) => {
  const userId = c.get('userId')
  const { searchId } = c.req.valid('param')

  const { data: search } = await supabase
    .from('searches')
    .select('parsed_brief, category')
    .eq('id', searchId)
    .eq('user_id', userId)
    .single()

  if (!search) return c.json({ error: 'Search not found' }, 404)

  const brief = search.parsed_brief as {
    category: string
    searchTerms: string[]
    priceMin?: number
    priceMax?: number
  }

  const query = brief.searchTerms.join(' ')
  let candidates: unknown[] = []
  const sources: string[] = []

  if (brief.category === 'flights') {
    // Flights have their own structured adapter — don't mix with product sources
    const terms = brief.searchTerms
    if (terms.length >= 2) {
      candidates = await searchFlights({
        origin: terms[0],
        destination: terms[1],
        date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        maxPrice: brief.priceMax,
      }).catch(() => [])
    }
    if (candidates.length) sources.push('amadeus')
  } else {
    // Run all configured adapters in parallel — Trade Me (NZ), eBay (global), Brave (web)
    const isVehicle = brief.category === 'marketplace'

    const [tmResult, ebayResult, webResult] = await Promise.allSettled([
      isTrademeconfigured
        ? (isVehicle
          ? searchTrademeMotors({ query, priceMax: brief.priceMax })
          : searchTrademe({ query, priceMax: brief.priceMax }))
        : Promise.resolve([]),

      isEbayConfigured
        ? searchEbay({ query, priceMin: brief.priceMin ?? undefined, priceMax: brief.priceMax ?? undefined })
        : Promise.resolve([]),

      isWebSearchConfigured
        ? searchWeb({ query, priceMax: brief.priceMax ?? undefined })
        : Promise.resolve([]),
    ])

    if (tmResult.status === 'fulfilled' && tmResult.value.length) {
      candidates.push(...tmResult.value); sources.push('trademe')
    }
    if (ebayResult.status === 'fulfilled' && ebayResult.value.length) {
      candidates.push(...ebayResult.value); sources.push('ebay')
    }
    if (webResult.status === 'fulfilled' && webResult.value.length) {
      candidates.push(...webResult.value); sources.push('web')
    }

    // Last resort: internal stub catalogue
    if (candidates.length === 0) {
      const { data: products } = await supabase
        .from('products')
        .select('*, sellers(trust_tier, business_name)')
        .ilike('name', `%${query}%`)
        .eq('stock_available', true)
        .lte('price', brief.priceMax ?? 99999)
        .limit(20)
      candidates = products ?? []
      if (candidates.length) sources.push('internal')
    }
  }

  // Load user preferences for personalised AI ranking
  const { data: preferences } = await supabase
    .from('preferences')
    .select('category, positive_signals, negative_signals')
    .eq('user_id', userId)

  const prefContext = (preferences ?? []).map((p) => ({
    category: p.category,
    positiveSignals: p.positive_signals,
    negativeSignals: p.negative_signals,
  }))

  const { ranked, summaries } = await rankResults(brief as Parameters<typeof rankResults>[0], candidates, prefContext)

  await supabase
    .from('searches')
    .update({ results_shown: ranked.slice(0, 10) })
    .eq('id', searchId)

  const results = ranked.map((r, i) => ({
    ...(r as object),
    aiSummary: summaries[String(i)],
  }))

  return c.json({ results, total: ranked.length, sources })
})
