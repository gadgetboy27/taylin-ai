/**
 * Shallow-crawl catalogue import — a seller submits a URL, we fetch the
 * homepage plus a handful of obviously-relevant nav links (shop/products/
 * menu/store), and ask Claude to pull out whatever products it can find on
 * each page. Best-effort only: capped at 5 pages, no JS rendering (a plain
 * fetch, not a headless browser), so heavily JS-rendered storefronts won't
 * extract well. That's an accepted MVP limitation, not a bug to work around.
 */
import * as cheerio from 'cheerio'
import { supabase } from './supabase.js'
import { extractProducts, type ExtractedProduct } from './ai-wrapper.js'

const FETCH_TIMEOUT_MS = 8000
const MAX_PAGES = 5
const NAV_LINK_PATTERN = /shop|products|menu|store/i

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Taylin-CatalogueImport/1.0 (+https://taylin.ai/verification)',
        Accept: 'text/html',
      },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function extractPageText(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, nav, footer').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}

function findCandidateLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const origin = new URL(baseUrl).origin
  const links = new Set<string>()

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    const text = $(el).text()
    if (!href) return
    if (!NAV_LINK_PATTERN.test(href) && !NAV_LINK_PATTERN.test(text)) return
    try {
      const resolved = new URL(href, baseUrl)
      if (resolved.origin === origin) links.add(resolved.toString())
    } catch {
      // malformed href — skip
    }
  })

  return [...links].slice(0, MAX_PAGES - 1) // -1 to leave room for the homepage itself
}

export type CatalogueImportResult = {
  pagesScanned: number
  productsFound: number
  productsInserted: number
}

/**
 * Crawl and extract, without touching the database.
 *
 * Split out from importCatalogue so the interview can start crawling the
 * moment a seller gives their website — there is no seller row yet at that
 * point, and the crawl takes long enough (several page fetches plus an LLM
 * call each) that doing it at the end would leave them waiting.
 */
export async function crawlCatalogue(rawUrl: string): Promise<{
  pagesScanned: number
  products: ExtractedProduct[]
}> {
  let baseUrl: string
  try {
    baseUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).toString()
  } catch {
    return { pagesScanned: 0, products: [] }
  }

  const homepageHtml = await fetchPage(baseUrl)
  if (!homepageHtml) return { pagesScanned: 0, products: [] }

  const pagesToScan = [baseUrl, ...findCandidateLinks(homepageHtml, baseUrl)]
  const found: ExtractedProduct[] = []
  let pagesScanned = 0

  for (const pageUrl of pagesToScan) {
    const html = pageUrl === baseUrl ? homepageHtml : await fetchPage(pageUrl)
    if (!html) continue
    pagesScanned++
    found.push(...await extractProducts(extractPageText(html), pageUrl))
  }

  return { pagesScanned, products: found }
}

/** Persist already-extracted products against a seller, deduped. */
export async function saveCatalogue(
  sellerId: string,
  found: ExtractedProduct[],
  pagesScanned: number
): Promise<CatalogueImportResult> {
  // Drop anything without a price rather than guessing $0 — an unpriced
  // extraction is more likely a mis-parsed heading than a real free item.
  const priced = found.filter((p): p is ExtractedProduct & { price: number } => p.price != null && p.price >= 0)

  const { data: existing } = await supabase.from('products').select('name').eq('seller_id', sellerId)
  const existingNames = new Set((existing ?? []).map((p) => p.name.trim().toLowerCase()))

  const seen = new Set<string>()
  const toInsert = priced.filter((p) => {
    const key = p.name.trim().toLowerCase()
    if (!key || seen.has(key) || existingNames.has(key)) return false
    seen.add(key)
    return true
  })

  if (toInsert.length > 0) {
    await supabase.from('products').insert(
      toInsert.map((p) => ({
        seller_id: sellerId,
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category,
      }))
    )
  }

  await supabase.from('sellers').update({ catalogue_last_synced: new Date().toISOString() }).eq('id', sellerId)
  return { pagesScanned, productsFound: found.length, productsInserted: toInsert.length }
}

export async function importCatalogue(sellerId: string, rawUrl: string): Promise<CatalogueImportResult> {
  const { pagesScanned, products } = await crawlCatalogue(rawUrl)
  return saveCatalogue(sellerId, products, pagesScanned)
}
