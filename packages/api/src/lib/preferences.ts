import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase.js'
import { parseJsonFromText } from './parse-json.js'

const MAX_SIGNALS = 100

let anthropic: Anthropic | null = null
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return anthropic
}

// Extract 3-5 signal strings from any product object shape.
// Returns tags like ["brand:Toyota", "condition:used", "price_range:budget"]
async function extractSignals(product: unknown, category: string): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [`category:${category}`]

  try {
    const msg = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: 'Return only valid JSON. No explanation.',
      messages: [{
        role: 'user',
        content: `Extract 3-5 preference signals from this product. Category: ${category}.
Product: ${JSON.stringify(product)}

Return JSON: { "signals": ["brand:X", "condition:new|used", "price_range:budget|mid|premium", "style:X", "material:X"] }
Only include signals that are clearly present. Use lowercase snake_case values.`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
    const parsed = parseJsonFromText<{ signals?: string[] }>(text, {})
    return Array.isArray(parsed.signals) ? parsed.signals.filter((s) => typeof s === 'string') : []
  } catch {
    return [`category:${category}`]
  }
}

// Merge new signals into an existing array, dedup, cap at MAX_SIGNALS.
// Signals seen multiple times bubble to the front.
function mergeSignals(existing: string[], incoming: string[]): string[] {
  const seen = new Map<string, number>()
  for (const s of existing) seen.set(s, (seen.get(s) ?? 0) + 1)
  for (const s of incoming) seen.set(s, (seen.get(s) ?? 0) + 1)
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SIGNALS)
    .map(([s]) => s)
}

export type SignalAction = 'like' | 'purchase' | 'dislike' | 'skip'

// Core function — call this after any user action on a result.
export async function recordSignal(
  userId: string,
  category: string,
  product: unknown,
  action: SignalAction,
): Promise<void> {
  const signals = await extractSignals(product, category)
  if (signals.length === 0) return

  const isPositive = action === 'like' || action === 'purchase'
  const column = isPositive ? 'positive_signals' : 'negative_signals'

  // Fetch existing row for this user+category
  const { data: existing } = await supabase
    .from('preferences')
    .select('id, positive_signals, negative_signals')
    .eq('user_id', userId)
    .eq('category', category)
    .single()

  const currentSignals: string[] = existing?.[column] ?? []
  const merged = mergeSignals(currentSignals, signals)

  if (existing) {
    await supabase
      .from('preferences')
      .update({ [column]: merged, last_updated: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('preferences')
      .insert({
        user_id: userId,
        category,
        positive_signals: isPositive ? merged : [],
        negative_signals: isPositive ? [] : merged,
      })
  }
}
