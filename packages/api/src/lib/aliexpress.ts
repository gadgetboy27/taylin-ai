/**
 * AliExpress Affiliate Product API
 * Sign up: https://portals.aliexpress.com → Developer Console → App Key + Secret
 * Docs:    https://openservice.aliexpress.com/doc/api.htm
 *          Method: aliexpress.affiliate.product.query
 */
import crypto from 'node:crypto'

const BASE = 'https://api-sg.aliexpress.com/sync'

export const isAliexpressConfigured =
  !!(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET)

export interface AliexpressResult {
  id: string
  name: string
  price: number
  currency: string
  image: string
  additionalImages: string[]
  url: string
  seller: { name: string; rating: number }
  source: 'aliexpress'
}

// TOP API signing: appSecret + sorted(key+value pairs) + appSecret → uppercase MD5
function sign(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join('')
  return crypto.createHash('md5').update(`${secret}${sorted}${secret}`).digest('hex').toUpperCase()
}

function normaliseImage(url?: string): string | undefined {
  if (!url) return undefined
  // AliExpress sometimes returns protocol-relative URLs
  return url.startsWith('//') ? `https:${url}` : url
}

export async function searchAliexpress({
  query,
  priceMin,
  priceMax,
}: {
  query: string
  priceMin?: number
  priceMax?: number
}): Promise<AliexpressResult[]> {
  const appKey = process.env.ALIEXPRESS_APP_KEY!
  const appSecret = process.env.ALIEXPRESS_APP_SECRET!

  const params: Record<string, string> = {
    method: 'aliexpress.affiliate.product.query',
    app_key: appKey,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    v: '2.0',
    format: 'json',
    sign_method: 'md5',
    keywords: query,
    page_no: '1',
    page_size: '20',
    target_currency: 'USD',
    target_language: 'EN',
    sort: 'LAST_VOLUME_DESC', // sort by recent sales volume — most popular first
  }

  if (priceMin) params.min_sale_price = String(Math.round(priceMin * 100))
  if (priceMax) params.max_sale_price = String(Math.round(priceMax * 100))

  params.sign = sign(params, appSecret)

  const url = `${BASE}?${new URLSearchParams(params)}`

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return []
  }
  if (!res.ok) return []

  const data = await res.json() as {
    aliexpress_affiliate_product_query_response?: {
      resp_result?: {
        result?: {
          products?: {
            product?: Array<{
              product_id: number
              product_title: string
              target_sale_price: string
              target_sale_price_currency: string
              product_main_image_url: string
              product_small_image_urls?: { string: string[] }
              product_detail_url: string
              store_name?: string
              evaluate_rate?: string
            }>
          }
        }
      }
    }
  }

  const products =
    data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? []

  return products.map((p) => {
    const extraImages = (p.product_small_image_urls?.string ?? [])
      .map(normaliseImage)
      .filter((u): u is string => !!u)
      .slice(0, 5)

    return {
      id: String(p.product_id),
      name: p.product_title,
      price: parseFloat(p.target_sale_price ?? '0'),
      currency: p.target_sale_price_currency ?? 'USD',
      image: normaliseImage(p.product_main_image_url) ?? '',
      additionalImages: extraImages,
      url: p.product_detail_url,
      seller: {
        name: p.store_name ?? 'AliExpress Seller',
        rating: parseFloat(p.evaluate_rate ?? '0'),
      },
      source: 'aliexpress' as const,
    }
  })
}
