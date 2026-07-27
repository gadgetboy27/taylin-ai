import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'

export const notificationsRoute = new Hono()

// ── Register (or refresh) a device's push token ───────────────────────────────
notificationsRoute.post(
  '/register-token',
  zValidator('json', z.object({
    token: z.string().min(1),
    platform: z.enum(['ios', 'android', 'web']),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { token, platform } = c.req.valid('json')

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      )

    if (error) return c.json({ error: 'Failed to register token' }, 500)
    return c.json({ registered: true })
  }
)

// Sending is intentionally NOT an HTTP route — lib/push.ts's sendNotification()
// is called directly, in-process, by whatever backend code needs to notify a
// user (e.g. Phase 6's proactive-suggestion flow). An HTTP endpoint here would
// let anyone who can guess a userId spam notifications with no real caller
// needing it from outside the API process.
