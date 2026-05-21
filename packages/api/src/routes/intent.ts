import { Hono } from 'hono'
import { parseIntent } from '../lib/ai-wrapper.js'
import { supabase, createUserClient } from '../lib/supabase.js'
import { validateIntent } from '../middleware/validate.js'

export const intentRoute = new Hono()

intentRoute.post('/', validateIntent, async (c) => {
  const userId = c.get('userId')
  const jwt = c.get('userJwt')
  const { prompt } = c.req.valid('json')

  // Fetch user's spend limit and preferences
  const [userResult, prefResult] = await Promise.all([
    supabase
      .from('users')
      .select('spend_limit_per_tx')
      .eq('id', userId)
      .single(),
    supabase
      .from('preferences')
      .select('category, positive_signals, negative_signals')
      .eq('user_id', userId)
      .limit(10),
  ])

  const spendLimit = userResult.data?.spend_limit_per_tx ?? 200
  const preferences = (prefResult.data ?? []).map((p) => ({
    category: p.category,
    positiveSignals: p.positive_signals,
    negativeSignals: p.negative_signals,
  }))

  const brief = await parseIntent(prompt, preferences, spendLimit)

  // Use service client in dev (dev-test-token isn't a real Supabase JWT, so RLS rejects it)
  const insertClient = jwt === 'dev-test-token' ? supabase : createUserClient(jwt)
  const { data: search, error } = await insertClient
    .from('searches')
    .insert({
      user_id: userId,
      raw_prompt: prompt,
      parsed_brief: brief,
      category: brief.category,
    })
    .select('id')
    .single()

  if (error || !search) {
    console.error('[intent] insert failed:', error?.message)
    return c.json({ error: 'Failed to save search' }, 500)
  }

  return c.json({ searchId: search.id, brief })
})
