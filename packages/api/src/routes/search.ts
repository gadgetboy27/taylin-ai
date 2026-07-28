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
import { applyLocalSellerFloor, RESULT_LIMIT } from '../lib/ranking-fairness.js'
import { findLocalProducts, getBuyerLocality } from '../lib/local-search.js'

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

  // Match individual words across name, description and category — not whole
  // phrases against name alone.
  //
  // Two things broke that. searchTerms are alternative phrasings of one intent,
  // so joining them produced nonsense like "coffee beans good coffee beans".
  // And matching a phrase against `name` cannot work on a real catalogue: a
  // brief of "single origin coffee beans" has to find a product actually called
  // "Sumatra Mandheling 250g", whose generic words live in category
  // ("Single Origin") and description, never the name. A long phrase can't
  // substring-match a short field either, so it has to be word-level.
  //
  // Commas and parens are stripped because PostgREST's `or` filter uses them as
  // syntax; % and _ because they are ilike wildcards.
  const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'good', 'best', 'some', 'any', 'new'])
  const words = Array.from(new Set(
    brief.searchTerms
      .flatMap((t) => t.replace(/[,()%_]/g, ' ').toLowerCase().split(/\s+/))
      .map((w) => w.trim())
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
  ))

  const orFilter = words
    .flatMap((w) => [`name.ilike.%${w}%`, `description.ilike.%${w}%`, `category.ilike.%${w}%`])
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
    // Local first, external only if needed.
    //
    // Every adapter used to fire on every search, so each one cost an eBay and
    // a Brave call regardless of whether the local market could answer, and the
    // ranker received a candidate list dominated by external results. That
    // domination is why ranking-fairness.ts exists — local sellers were being
    // crowded out of a pool they barely featured in. Fetching them first means
    // there is nothing to crowd them out.
    const isVehicle = brief.category === 'marketplace'
    const locality = await getBuyerLocality(userId)

    const local = await findLocalProducts({
      orFilter: orFilter || `name.ilike.%${query}%`,
      priceMax: brief.priceMax ?? 99999,
      locality,
      enough: RESULT_LIMIT,
    })

    if (local.rows.length) {
      candidates.push(...local.rows.map((r) => {
        const row = r as Record<string, unknown> & { sellers?: { trust_tier?: number; status?: string } }
        return {
          ...row,
          origin: 'internal',
          sellerStatus: row.sellers?.status,
          trustTier: row.sellers?.trust_tier,
        }
      }))
      sources.push(local.rung ? `internal:${local.rung}` : 'internal')
    }

    // Only reach for paid external sources when local supply is genuinely thin.
    if (candidates.length < RESULT_LIMIT) {
      const [tmResult, ebayResult, webResult, aliResult] = await Promise.allSettled([
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
