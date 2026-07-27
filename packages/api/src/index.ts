import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { intentRoute } from './routes/intent.js'
import { searchRoute } from './routes/search.js'
import { tokenRoute } from './routes/token.js'
import { orderRoute } from './routes/order.js'
import { escrowRoute } from './routes/escrow.js'
import { sellersRoute } from './routes/sellers.js'
import { adminSellersRoute } from './routes/admin/sellers.js'
import { preferencesRoute } from './routes/preferences.js'
import { signalsRoute } from './routes/signals.js'
import { voiceRoute } from './routes/voice.js'
import { authRoute } from './routes/auth.js'
import { researchRoute } from './routes/research.js'
import { notificationsRoute } from './routes/notifications.js'
import { suggestionsRoute } from './routes/suggestions.js'
import { profileRoute } from './routes/profile.js'
import { dealsRoute } from './routes/deals.js'
import { couriersRoute } from './routes/couriers.js'
import { connectRoute } from './routes/connect.js'
import { authMiddleware } from './middleware/auth.js'
import { rateLimitMiddleware } from './middleware/rateLimit.js'
import { adminMiddleware } from './middleware/admin.js'

const app = new Hono()

// ── Global middleware ──────────────────────────────────────────────────────────
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://taylin.ai'] : '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}))

// ── Health check — no auth required ───────────────────────────────────────────
app.get('/health', (c) => c.json({ ok: true, service: 'taylin-api' }))

// ── Dev-only: stateless Taylor chat test (no DB, no auth) ─────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.post('/dev/taylor', async (c) => {
    const { conductInterview } = await import('./lib/seller-interview.js')
    const body = await c.req.json() as { history?: unknown[] }
    const history = (body.history ?? []) as Parameters<typeof conductInterview>[0]
    const { response } = await conductInterview(history, {})
    return c.json({ message: response.message, stage: response.stage, complete: response.complete })
  })
}

// ── Protected routes — auth + rate limit on all ───────────────────────────────
app.use('/intent', authMiddleware)
app.use('/search/*', authMiddleware)
app.use('/token', authMiddleware)
app.use('/order', authMiddleware)
app.use('/escrow/*', authMiddleware)
app.use('/preferences/*', authMiddleware)
app.use('/signals/*', authMiddleware)
app.use('/voice/*', authMiddleware)
app.use('/sellers/apply/*', authMiddleware)
app.use('/sellers/me', authMiddleware)
app.use('/admin/*', adminMiddleware)
app.use('/research', authMiddleware)
app.use('/notifications/*', authMiddleware)
app.use('/suggestions', authMiddleware)
app.use('/profile/*', authMiddleware)
app.use('/connect/*', authMiddleware)

app.use('/intent', rateLimitMiddleware('searches'))
app.use('/order', rateLimitMiddleware('orders'))

// ── Route mounting ────────────────────────────────────────────────────────────
app.route('/intent', intentRoute)
app.route('/search', searchRoute)
app.route('/token', tokenRoute)
app.route('/order', orderRoute)
app.route('/escrow', escrowRoute)
app.route('/sellers', sellersRoute)
app.route('/admin/sellers', adminSellersRoute)
app.route('/preferences', preferencesRoute)
app.route('/signals', signalsRoute)
app.route('/voice', voiceRoute)
app.route('/auth', authRoute)
app.route('/research', researchRoute)
app.route('/notifications', notificationsRoute)
app.route('/suggestions', suggestionsRoute)
app.route('/profile', profileRoute)
app.route('/deals', dealsRoute)
app.route('/couriers', couriersRoute)
app.route('/connect', connectRoute)

// ── 404 handler ───────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  // Never leak stack traces in production
  const isProd = process.env.NODE_ENV === 'production'
  console.error(isProd ? err.message : err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = parseInt(process.env.PORT ?? '3000', 10)
serve({ fetch: app.fetch, port }, () => {
  console.log(`taylin.ai API running on port ${port}`)
})

export default app
