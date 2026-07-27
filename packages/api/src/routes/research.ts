import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { askBrave, isBraveAnswersConfigured } from '../lib/brave-answers.js'

export const researchRoute = new Hono()

// Per-user hourly cap. Every call costs money at Brave AI Answers, and unlike
// /intent there's no row written anywhere to count, so the shared DB-backed
// rateLimitMiddleware can't measure this endpoint — it would count searches
// the user never made here. Held in memory: per-process and reset on restart,
// which is fine while the API runs as a single instance. Move it to the shared
// store if this ever scales horizontally.
const RESEARCH_PER_HOUR = parseInt(process.env.RATE_LIMIT_RESEARCH_PER_HOUR ?? '20', 10)
const WINDOW_MS = 3600_000
const callTimes = new Map<string, number[]>()

function overLimit(userId: string): boolean {
  const cutoff = Date.now() - WINDOW_MS

  for (const [id, times] of callTimes) {
    const recent = times.filter((t) => t > cutoff)
    if (recent.length) callTimes.set(id, recent)
    else callTimes.delete(id)
  }

  const recent = callTimes.get(userId) ?? []
  if (recent.length >= RESEARCH_PER_HOUR) return true

  callTimes.set(userId, [...recent, Date.now()])
  return false
}

// POST /research
// Market intelligence — answers "what should I pay for X?", auction history,
// price validation, product authenticity checks. Powered by Brave AI Answers.
researchRoute.post(
  '/',
  zValidator('json', z.object({ query: z.string().min(3).max(300).trim() })),
  async (c) => {
    const { query } = c.req.valid('json')

    if (overLimit(c.get('userId'))) {
      return c.json({ error: 'Rate limit exceeded', retryAfter: WINDOW_MS / 1000 }, 429)
    }

    if (!isBraveAnswersConfigured) {
      return c.json({ error: 'Research not configured — add BRAVE_AI_ANSWERS_KEY to .env' }, 503)
    }

    try {
      const result = await askBrave(query)
      return c.json(result)
    } catch (err) {
      console.error('[research] Brave AI Answers failed:', err)
      return c.json({ error: 'Research query failed' }, 500)
    }
  },
)
