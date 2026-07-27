import { createHmac, randomBytes } from 'crypto'

const consumerKey = process.env.TRADEME_CONSUMER_KEY
const consumerSecret = process.env.TRADEME_CONSUMER_SECRET
const isSandbox = process.env.TRADEME_SANDBOX === 'true'

const BASE_URL = isSandbox
  ? 'https://api.tmsandbox.co.nz/v1'
  : 'https://api.trademe.co.nz/v1'

if (!consumerKey || !consumerSecret) {
  console.warn('[trademe] TRADEME_CONSUMER_KEY / TRADEME_CONSUMER_SECRET not set — Trade Me search disabled')
}

export const isTrademeconfigured = !!(consumerKey && consumerSecret)

// OAuth 1.0a signing — Trade Me uses application-only auth (no user token) for public search
function buildOAuthHeader(method: string, url: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomBytes(16).toString('hex')

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey!,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
  }

  // Build parameter string (sorted alphabetically)
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&')

  // Signature base string
  const sigBase = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(paramString)].join('&')

  // Signing key — consumer_secret& (empty token secret for app-only auth)
  const signingKey = `${encodeURIComponent(consumerSecret!)}&`
  const signature = createHmac('sha1', signingKey).update(sigBase).digest('base64')

  const headerParts = {
    ...oauthParams,
    oauth_signature: signature,
  }

  // Object.entries rather than keys + index: spreading oauthParams into an
  // object literal drops the Record<string, string> index signature, so
  // headerParts[k] is not indexable by an arbitrary string.
  const headerStr = Object.entries(headerParts)
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ')

  return `OAuth ${headerStr}`
}

export type TrademeListing = {
  id: string
  title: string
  price: number | null
  buyNowPrice: number | null
  imageUrl: string | null
  region: string
  category: string
  sellerNick: string
  listingUrl: string
  isNew: boolean
}

type RawListing = {
  ListingId: number
  Title: string
  StartPrice?: number
  BuyNowPrice?: number
  PictureHref?: string
  Region?: string
  CategoryPath?: string
  MemberProfile?: { Nickname?: string }
  Condition?: string
}

function mapListing(raw: RawListing): TrademeListing {
  return {
    id: String(raw.ListingId),
    title: raw.Title,
    price: raw.StartPrice ?? null,
    buyNowPrice: raw.BuyNowPrice ?? null,
    imageUrl: raw.PictureHref ?? null,
    region: raw.Region ?? 'New Zealand',
    category: raw.CategoryPath ?? '',
    sellerNick: raw.MemberProfile?.Nickname ?? 'Unknown',
    listingUrl: `https://www.trademe.co.nz/a/marketplace/listing/${raw.ListingId}`,
    isNew: raw.Condition === 'New',
  }
}

export async function searchTrademe(params: {
  query: string
  priceMax?: number
  rows?: number
}): Promise<TrademeListing[]> {
  if (!isTrademeconfigured) return []

  const url = `${BASE_URL}/Search/General.json`
  const qs = new URLSearchParams({ search_string: params.query, rows: String(params.rows ?? 20) })
  if (params.priceMax) qs.set('price_max', String(params.priceMax))

  const fullUrl = `${url}?${qs}`
  const authHeader = buildOAuthHeader('GET', url)

  const res = await fetch(fullUrl, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    console.error(`[trademe] search failed: ${res.status} ${await res.text()}`)
    return []
  }

  const data = await res.json() as { List?: RawListing[] }
  return (data.List ?? []).map(mapListing)
}

export async function searchTrademeMotors(params: {
  query: string
  priceMax?: number
}): Promise<TrademeListing[]> {
  if (!isTrademeconfigured) return []

  const url = `${BASE_URL}/Search/Motors/Used.json`
  const qs = new URLSearchParams({ search_string: params.query, rows: '20' })
  if (params.priceMax) qs.set('price_max', String(params.priceMax))

  const fullUrl = `${url}?${qs}`
  const authHeader = buildOAuthHeader('GET', url)

  const res = await fetch(fullUrl, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  })

  if (!res.ok) return []
  const data = await res.json() as { List?: RawListing[] }
  return (data.List ?? []).map(mapListing)
}
