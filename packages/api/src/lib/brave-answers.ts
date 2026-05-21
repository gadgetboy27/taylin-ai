/**
 * Market intelligence — answers "what should I pay for X?", price history,
 * authenticity checks, auction records.
 *
 * Flow: Brave Web Search (working key) → top snippets → Haiku synthesises answer.
 * If Brave returns a native summarizer key we use that instead (faster, cheaper).
 */
import Anthropic from '@anthropic-ai/sdk'
import { parseJsonFromText } from './parse-json.js'

const BASE = 'https://api.search.brave.com/res/v1'

// Web search always uses the Search key (different subscription tier to AI Answers)
// Summarizer step uses AI Answers key if present, otherwise falls back to Haiku synthesis
function getSearchKey() { return process.env.BRAVE_SEARCH_API_KEY }
function getSummarizerKey() { return process.env.BRAVE_AI_ANSWERS_KEY || process.env.BRAVE_SEARCH_API_KEY }

export const isBraveAnswersConfigured = !!process.env.BRAVE_SEARCH_API_KEY

export interface ResearchAnswer {
  answer: string
  followUps: string[]
  sources: Array<{ title: string; url: string }>
}

export async function askBrave(query: string): Promise<ResearchAnswer> {
  const searchKey = getSearchKey()
  if (!searchKey) throw new Error('BRAVE_SEARCH_API_KEY not configured')

  // Step 1 — web search with the Search key, request summary if available
  const searchRes = await fetch(
    `${BASE}/web/search?q=${encodeURIComponent(query)}&summary=1&count=8`,
    { headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': searchKey } },
  )
  if (!searchRes.ok) throw new Error(`Brave search failed: ${searchRes.status}`)

  const searchData = await searchRes.json() as {
    summarizer?: { key: string } | null
    web?: { results: Array<{ title: string; url: string; description: string }> }
  }

  const webResults = searchData.web?.results ?? []
  const sources = webResults.slice(0, 5).map((r) => ({ title: r.title, url: r.url }))

  // Step 2a — native Brave summarizer (uses AI Answers key if available)
  if (searchData.summarizer?.key) {
    const summarizerKey = getSummarizerKey()!
    const sumRes = await fetch(
      `${BASE}/summarizer/search?key=${encodeURIComponent(searchData.summarizer.key)}&entity_info=1`,
      { headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': summarizerKey } },
    )
    if (sumRes.ok) {
      const sumData = await sumRes.json() as {
        summary?: Array<{ data?: string }>
        followups?: string[]
      }
      const answer = (sumData.summary ?? []).map((s) => s.data ?? '').join(' ').trim()
      if (answer) {
        return { answer, followUps: sumData.followups?.slice(0, 3) ?? [], sources }
      }
    }
  }

  // Step 2b — fallback: Haiku synthesises the answer from web snippets
  if (webResults.length === 0) {
    return { answer: 'No information found for that query.', followUps: [], sources: [] }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    // No Haiku — return best snippet as plain answer
    return { answer: webResults[0].description, followUps: [], sources }
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const snippets = webResults.slice(0, 6).map((r) => `${r.title}: ${r.description}`).join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: 'You are a market research expert. Answer concisely based only on the sources provided. Return JSON only.',
    messages: [{
      role: 'user',
      content: `Question: "${query}"

Sources:
${snippets}

Return JSON:
{
  "answer": "2-3 sentence direct answer with specific prices/dates where available",
  "followUps": ["A related question the buyer should also ask", "Another useful follow-up"]
}`,
    }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
  const parsed = parseJsonFromText<{ answer?: string; followUps?: string[] }>(text, {})

  return {
    answer: parsed.answer ?? webResults[0].description,
    followUps: parsed.followUps?.slice(0, 3) ?? [],
    sources,
  }
}
