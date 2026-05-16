/**
 * SECURE AI WRAPPER — server only. All AI model calls live here.
 * Zero AI keys ever leave this file or reach the mobile app.
 */
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const isConfigured = !!process.env.ANTHROPIC_API_KEY && !!process.env.GEMINI_API_KEY

let anthropic: Anthropic
let gemini: GoogleGenerativeAI

if (isConfigured) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
} else {
  console.warn('[ai-wrapper] Running without AI keys — intent parsing will return stubs')
}

export type IntentBrief = {
  category: 'retail' | 'flights' | 'hotels' | 'food' | 'marketplace' | 'grocery'
  searchTerms: string[]
  priceMin?: number
  priceMax?: number
  deliveryByDate?: string
  qualitySignals: string[]
  negativeConstraints: string[]
  urgency: 'immediate' | 'flexible' | 'monitor'
  isGift: boolean
  giftContext?: string
}

export type PreferenceContext = {
  category: string
  positiveSignals: string[]
  negativeSignals: string[]
  priceRange?: { min: number; max: number }
}

function stubBrief(rawPrompt: string): IntentBrief {
  return {
    category: 'retail',
    searchTerms: rawPrompt.split(' ').slice(0, 3),
    qualitySignals: [],
    negativeConstraints: [],
    urgency: 'immediate',
    isGift: false,
  }
}

export async function parseIntent(
  rawPrompt: string,
  preferences: PreferenceContext[],
  spendLimit: number
): Promise<IntentBrief> {
  if (!isConfigured) return stubBrief(rawPrompt)

  const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
  const prefContext = preferences.length > 0
    ? `\n\nUser preference context:\n${JSON.stringify(preferences, null, 2)}`
    : ''

  const prompt = `You are an expert purchasing agent. Convert this natural language request into a structured purchasing brief JSON.

User request: "${rawPrompt}"
Maximum spend limit: $${spendLimit} NZD${prefContext}

Return ONLY valid JSON matching this exact schema, no markdown, no explanation:
{
  "category": "retail|flights|hotels|food|marketplace|grocery",
  "searchTerms": ["term1", "term2"],
  "priceMin": null,
  "priceMax": null,
  "deliveryByDate": null,
  "qualitySignals": [],
  "negativeConstraints": [],
  "urgency": "immediate|flexible|monitor",
  "isGift": false,
  "giftContext": null
}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    return JSON.parse(text) as IntentBrief
  } catch {
    return parseIntentFallback(rawPrompt, preferences, spendLimit)
  }
}

async function parseIntentFallback(
  rawPrompt: string,
  preferences: PreferenceContext[],
  spendLimit: number
): Promise<IntentBrief> {
  if (!isConfigured) return stubBrief(rawPrompt)

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    system: 'You are an expert purchasing agent. Always respond with valid JSON only.',
    messages: [{
      role: 'user',
      content: `Parse this purchasing request into structured JSON.
Request: "${rawPrompt}"
Spend limit: $${spendLimit} NZD
Preferences: ${JSON.stringify(preferences)}

Return only valid JSON with keys: category, searchTerms, priceMin, priceMax,
deliveryByDate, qualitySignals, negativeConstraints, urgency, isGift, giftContext`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return stubBrief(rawPrompt)
  return JSON.parse(match[0]) as IntentBrief
}

export async function rankResults(
  brief: IntentBrief,
  candidates: unknown[],
  preferences: PreferenceContext[]
): Promise<{ ranked: unknown[]; summaries: Record<string, string> }> {
  if (candidates.length === 0) return { ranked: [], summaries: {} }
  if (!isConfigured) return { ranked: candidates.slice(0, 3), summaries: {} }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1000,
    system: 'You are a product ranking expert. Return only valid JSON.',
    messages: [{
      role: 'user',
      content: `Rank these products for this buyer.

Brief: ${JSON.stringify(brief)}
Preferences: ${JSON.stringify(preferences)}
Products: ${JSON.stringify(candidates.map((c, i) => ({ index: i, ...(c as object) })))}

Return JSON:
{
  "rankedIndices": [0, 2, 1],
  "summaries": { "0": "One sentence why this matches" }
}`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { ranked: candidates.slice(0, 3), summaries: {} }

  const parsed = JSON.parse(match[0]) as {
    rankedIndices: number[]
    summaries: Record<string, string>
  }
  const ranked = parsed.rankedIndices.map((i) => candidates[i]).filter(Boolean).slice(0, 10)
  return { ranked, summaries: parsed.summaries ?? {} }
}

export function generateNudge(totalResults: number, shownCount: number, category: string): string {
  const remaining = totalResults - shownCount
  if (remaining <= 0) return ''
  const nudges: Record<string, string> = {
    flights: `${remaining} more flights found. Filter by shortest duration?`,
    retail: `${remaining} more matches. Sort by fastest delivery?`,
    food: `${remaining} more restaurants. Filter by delivery time?`,
  }
  return nudges[category] ?? `${remaining} more options available.`
}
