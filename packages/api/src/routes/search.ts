import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'
import { rankResults } from '../lib/ai-wrapper.js'
import { searchFlights } from '../lib/amadeus.js'
import { searchTrademe, searchTrademeMotors, isTrademeconfigured } from '../lib/trademe.js'
import { searchEbay, isEbayConfigured } from '../lib/ebay.js'
import { searchWeb, isWebSearchConfigured } from '../lib/web-search.js'
import { searchAliexpress, isAliexpressConfigured } from '../lib/aliexpress.js'
import { applyLocalSellerFloor } from '../lib/ranking-fairness.js'

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

  // searchTerms are alternative phrasings of the same intent, not words to
  // concatenate — a brief for "good coffee beans" comes back as
  // ["coffee beans", "good coffee beans"]. Joining them yields the phrase
  // "coffee beans good coffee beans", which `name ilike '%…%'` can never
  // match, so internal sellers silently returned nothing whenever the brief
  // had more than one term. Match any single term instead.
  // Commas and parens are stripped because PostgREST's `or` filter uses them
  // as syntax; `%` and `_` because they are ilike wildcards.
  const orFilter = brief.searchTerms
    .map((t) => t.replace(/[,()%_]/g, ' ').trim())
    .filter(Boolean)
    .map((t) => `name.ilike.%${t}%`)
    .join(',')

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
    // Run all sources in parallel — Trade Me (NZ), eBay (global), Brave (web),
    // AliExpress, and our own local sellers. Internal sellers used to only
    // surface as a last-resort fallback when every external source came back
    // empty — that structurally buried local/mom-and-pop listings any time a
    // big external marketplace had even one hit. They're a first-class
    // candidate source now; ranking-fairness.ts is what guarantees their
    // visibility, not exclusion-by-default.
    const isVehicle = brief.category === 'marketplace'

    const [tmResult, ebayResult, webResult, aliResult, internalResult] = await Promise.allSettled([
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

      isAliexpressConfigured
        ? searchAliexpress({ query, priceMin: brief.priceMin ?? undefined, priceMax: brief.priceMax ?? undefined })
        : Promise.resolve([]),

      // Only active sellers are searchable at all — suspended/banned sellers
      // are excluded here, not just deprioritized at ranking time.
      supabase
        .from('products')
        .select('*, sellers!inner(trust_tier, business_name, status)')
        .eq('sellers.status', 'active')
        .or(orFilter || `name.ilike.%${query}%`)
        .eq('stock_available', true)
        .lte('price', brief.priceMax ?? 99999)
        .limit(20)
        .then(({ data }) => data ?? []),
    ])

    if (tmResult.status === 'fulfilled' && tmResult.value.length) {
      candidates.push(...tmResult.value.map((r) => ({ ...r, origin: 'external' }))); sources.push('trademe')
    }
    if (ebayResult.status === 'fulfilled' && ebayResult.value.length) {
      candidates.push(...ebayResult.value.map((r) => ({ ...r, origin: 'external' }))); sources.push('ebay')
    }
    if (webResult.status === 'fulfilled' && webResult.value.length) {
      candidates.push(...webResult.value.map((r) => ({ ...r, origin: 'external' }))); sources.push('web')
    }
    if (aliResult.status === 'fulfilled' && aliResult.value.length) {
      candidates.push(...aliResult.value.map((r) => ({ ...r, origin: 'external' }))); sources.push('aliexpress')
    }
    if (internalResult.status === 'fulfilled' && internalResult.value.length) {
      candidates.push(...internalResult.value.map((r) => {
        const row = r as Record<string, unknown> & { sellers?: { trust_tier?: number; status?: string } }
        return {
          ...row,
          origin: 'internal',
          sellerStatus: row.sellers?.status,
          trustTier: row.sellers?.trust_tier,
        }
      }))
      sources.push('internal')
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

  const relevanceRanked = await rankResults(brief as Parameters<typeof rankResults>[0], candidates, prefContext)
  const { ranked, summaries } = applyLocalSellerFloor(relevanceRanked.ranked, relevanceRanked.summaries)

  await supabase
    .from('searches')
    .update({ results_shown: ranked })
    .eq('id', searchId)

  const results = ranked.map((r, i) => {
    const raw = r as Record<string, unknown>
    const extraImages = Array.isArray(raw.additionalImages) ? raw.additionalImages as string[] : []
    const primaryImage = typeof raw.image === 'string' ? raw.image : undefined
    return {
      ...raw,
      // normalise adapter field names to the mobile Product shape
      name: raw.name ?? raw.title,
      images: Array.isArray(raw.images) ? raw.images
        : [primaryImage, ...extraImages].filter(Boolean),
      aiSummary: summaries[String(i)],
    }
  })

  return c.json({ results, total: ranked.length, sources })
})
