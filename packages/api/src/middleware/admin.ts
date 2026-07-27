import type { MiddlewareHandler } from 'hono'

// Placeholder admin gate: a static key, not a real admin-role system. There
// is no admin/role concept on the users table yet — this exists so the
// seller review-queue endpoints aren't wide open, not as a finished auth
// design. Replace with a proper admin role check before any real launch.
export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const key = c.req.header('X-Admin-Key')
  const expected = process.env.ADMIN_API_KEY

  if (!expected || key !== expected) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}
