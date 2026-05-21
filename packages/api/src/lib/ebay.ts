const PRODUCTION_BASE = 'https://api.ebay.com'
const SANDBOX_BASE    = 'https://api.sandbox.ebay.com'

function base() {
  return process.env.EBAY_ENV === 'production' ? PRODUCTION_BASE : SANDBOX_BASE
}

export const isEbayConfigured = !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET)

// ── OAuth app token — cached in memory, auto-refreshed ────────────────────────
let cachedToken: { value: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value

  const creds = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`${base()}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  })
  if (!res.ok) throw new Error(`eBay token fetch failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.value
}

export interface EbayResult {
  id: string
  title: string
  price: number
  currency: string
  condition: string
  url: string
  image?: string
  seller: { name: string; rating: number }
  source: 'ebay'
}

export async function searchEbay({
  query,
  priceMax,
  condition,
}: {
  query: string
  priceMax?: number
  condition?: 'new' | 'used'
}): Promise<EbayResult[]> {
  const token = await getToken()

  const params = new URLSearchParams({ q: query, limit: '20', sort: 'price' })

  const filters: string[] = []
  if (priceMax)              filters.push(`price:[..${priceMax}]`)
  if (condition === 'new')   filters.push('conditionIds:{1000}')
  if (condition === 'used')  filters.push('conditionIds:{3000}')
  if (filters.length)        params.set('filter', filters.join(','))

  const res = await fetch(`${base()}/buy/browse/v1/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      'Content-Language': 'en-US',
    },
  })
  if (!res.ok) throw new Error(`eBay search failed: ${res.status}`)

  const data = await res.json() as {
    itemSummaries?: Array<{
      itemId: string
      title: string
      price: { value: string; currency: string }
      condition: string
      itemWebUrl: string
      thumbnailImages?: Array<{ imageUrl: string }>
      seller: { username: string; feedbackScore: number; feedbackPercentage: string }
    }>
  }

  return (data.itemSummaries ?? []).map((item) => ({
    id: item.itemId,
    title: item.title,
    price: parseFloat(item.price.value),
    currency: item.price.currency,
    condition: item.condition ?? 'Unknown',
    url: item.itemWebUrl,
    image: item.thumbnailImages?.[0]?.imageUrl,
    seller: { name: item.seller.username, rating: parseFloat(item.seller.feedbackPercentage ?? '0') },
    source: 'ebay' as const,
  }))
}
