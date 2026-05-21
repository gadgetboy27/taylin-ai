/**
 * Generic web search adapter — replaces the need for individual per-site API keys.
 *
 * Primary:  Brave Search API (free tier: 2 000 queries/month, no credit card needed)
 *           Sign up at https://brave.com/search/api/  → set BRAVE_SEARCH_API_KEY
 *
 * The search query is sent to Brave which indexes the whole web: eBay, Amazon,
 * Depop, Vestiaire, Chrono24, auction houses, brand sites — everything. Haiku
 * then pulls structured price/condition data out of the result snippets in one
 * cheap batch call.
 */
import Anthropic from '@anthropic-ai/sdk'
import { parseJsonFromText } from './parse-json.js'

export const isWebSearchConfigured = !!process.env.BRAVE_SEARCH_API_KEY

export interface WebResult {
  id: string
  title: string
  url: string
  snippet: string
  price?: number
  currency?: string
  source: 'web'
}

interface BraveWebResult {
  title: string
  url: string
  description: string
}

export async function searchWeb({
  query,
  priceMax,
}: {
  query: string
  priceMax?: number
}): Promise<WebResult[]> {
  if (!process.env.BRAVE_SEARCH_API_KEY) return []

  const priceHint = priceMax ? ` under $${priceMax}` : ''
  const fullQuery = `${query}${priceHint} buy price`

  let rawResults: BraveWebResult[] = []

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(fullQuery)}&count=10`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
        },
      },
    )
    if (!res.ok) return []
    const data = await res.json() as { web?: { results: BraveWebResult[] } }
    rawResults = data.web?.results ?? []
  } catch {
    return []
  }

  if (rawResults.length === 0) return []

  // ── Use Haiku to extract prices from snippets in one batch call ─────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return rawResults.slice(0, 8).map((r, i) => ({
      id: `web-${i}`,
      title: r.title,
      url: r.url,
      snippet: r.description,
      source: 'web' as const,
    }))
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const snippetInput = rawResults.slice(0, 8).map((r, i) => ({
    i,
    title: r.title,
    snippet: r.description,
  }))

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'Return only valid JSON. No explanation.',
      messages: [{
        role: 'user',
        content: `Extract prices from these web search results for "${query}".
Results: ${JSON.stringify(snippetInput)}

Return JSON: { "items": [{ "i": 0, "price": 350.00, "currency": "USD" }] }
Only include items where a price is clearly visible in the title or snippet. Skip the rest.`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const parsed = parseJsonFromText<{ items?: Array<{ i: number; price: number; currency: string }> }>(text, {})
    const priceMap = new Map((parsed.items ?? []).map((p) => [p.i, p]))

    return rawResults.slice(0, 8).map((r, i) => {
      const p = priceMap.get(i)
      return {
        id: `web-${i}`,
        title: r.title,
        url: r.url,
        snippet: r.description,
        price: p?.price,
        currency: p?.currency,
        source: 'web' as const,
      }
    })
  } catch {
    return rawResults.slice(0, 8).map((r, i) => ({
      id: `web-${i}`,
      title: r.title,
      url: r.url,
      snippet: r.description,
      source: 'web' as const,
    }))
  }
}
