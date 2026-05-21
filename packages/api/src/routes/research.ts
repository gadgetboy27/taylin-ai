import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { askBrave, isBraveAnswersConfigured } from '../lib/brave-answers.js'

export const researchRoute = new Hono()

// POST /research
// Market intelligence — answers "what should I pay for X?", auction history,
// price validation, product authenticity checks. Powered by Brave AI Answers.
researchRoute.post(
  '/',
  zValidator('json', z.object({ query: z.string().min(3).max(300).trim() })),
  async (c) => {
    const { query } = c.req.valid('json')

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
