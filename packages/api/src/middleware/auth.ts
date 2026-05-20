import type { MiddlewareHandler } from 'hono'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const DEV_BYPASS = process.env.NODE_ENV !== 'production'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const jwt = authHeader.slice(7)

  // Dev-only: accept a fixed test token so curl/Postman testing works without a real Supabase session
  if (DEV_BYPASS && jwt === 'dev-test-token') {
    c.set('userId', '00000000-0000-0000-0000-000000000001')
    c.set('userJwt', jwt)
    await next()
    return
  }

  // Verify the JWT with Supabase — this validates the user's session token
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error } = await client.auth.getUser(jwt)

  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Attach user to context for downstream route handlers
  c.set('userId', user.id)
  c.set('userJwt', jwt)

  await next()
}

// Extend Hono's context type
declare module 'hono' {
  interface ContextVariableMap {
    userId: string
    userJwt: string
  }
}
