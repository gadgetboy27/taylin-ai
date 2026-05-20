/**
 * Free online verification — no external API keys needed.
 * Fetches URLs the seller provides and does a basic DuckDuckGo search.
 */

const FETCH_TIMEOUT_MS = 6000

export type UrlVerifyResult = {
  url: string
  reachable: boolean
  title: string | null
  description: string | null
  // Keywords/signals extracted from the page that can be cross-referenced with interview
  signals: string[]
}

export type SearchResult = {
  query: string
  snippets: string[]   // top result snippets
  topUrl: string | null
}

/**
 * Fetch a URL and extract basic identity signals.
 * Used to verify a seller's website/Facebook/Instagram matches what they told us.
 */
export async function verifyUrl(rawUrl: string): Promise<UrlVerifyResult> {
  let url: string
  try {
    const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`)
    url = u.toString()
  } catch {
    return { url: rawUrl, reachable: false, title: null, description: null, signals: [] }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Taylin-Verify/1.0 (+https://taylin.ai/verification)',
        Accept: 'text/html',
      },
    })
    clearTimeout(timer)

    if (!res.ok) {
      return { url, reachable: false, title: null, description: null, signals: [] }
    }

    const html = await res.text()
    const title = extractMeta(html, 'title') ?? extractTag(html, 'title')
    const description =
      extractMeta(html, 'description') ??
      extractMeta(html, 'og:description') ??
      null

    // Pull h1/h2 text and og:type for signal extraction
    const signals: string[] = []
    const h1Match = html.match(/<h1[^>]*>([^<]{3,120})<\/h1>/i)
    if (h1Match) signals.push(h1Match[1].replace(/\s+/g, ' ').trim())
    const h2Matches = [...html.matchAll(/<h2[^>]*>([^<]{3,80})<\/h2>/gi)]
    h2Matches.slice(0, 3).forEach((m) => signals.push(m[1].replace(/\s+/g, ' ').trim()))
    if (title) signals.push(title)

    return { url, reachable: true, title: title ?? null, description, signals }
  } catch {
    return { url, reachable: false, title: null, description: null, signals: [] }
  }
}

/**
 * DuckDuckGo instant-answer JSON search — no API key, best-effort.
 * Returns snippet text that the AI can use to cross-check the seller's claims.
 */
export async function searchBusiness(
  businessName: string,
  location = 'New Zealand'
): Promise<SearchResult> {
  const query = `${businessName} ${location}`
  const encoded = encodeURIComponent(query)
  const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1&no_html=1&skip_disambig=1`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Taylin-Verify/1.0 (+https://taylin.ai/verification)' },
    })
    clearTimeout(timer)

    if (!res.ok) return { query, snippets: [], topUrl: null }

    const json = await res.json() as {
      Abstract?: string
      AbstractText?: string
      AbstractURL?: string
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>
    }

    const snippets: string[] = []
    if (json.AbstractText) snippets.push(json.AbstractText)
    json.RelatedTopics?.slice(0, 3).forEach((t) => {
      if (t.Text && t.Text.length > 10) snippets.push(t.Text)
    })

    const topUrl = json.AbstractURL || json.RelatedTopics?.[0]?.FirstURL || null

    return { query, snippets, topUrl }
  } catch {
    return { query, snippets: [], topUrl: null }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractMeta(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']{2,300})["']`,
    'i'
  )
  const m = html.match(re)
  if (m) return m[1].trim()
  // Also try content-first ordering
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']{2,300})["'][^>]+(?:name|property)=["']${name}["']`,
    'i'
  )
  const m2 = html.match(re2)
  return m2 ? m2[1].trim() : undefined
}

function extractTag(html: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([^<]{2,200})</${tag}>`, 'i')
  const m = html.match(re)
  return m ? m[1].trim() : undefined
}
