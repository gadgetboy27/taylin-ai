import type { MiddlewareHandler } from 'hono'
import { supabase } from '../lib/supabase.js'

type BucketType = 'searches' | 'orders'

const LIMITS: Record<BucketType, { max: number; windowSeconds: number }> = {
  searches: {
    max: parseInt(process.env.RATE_LIMIT_SEARCHES_PER_HOUR ?? '20', 10),
    windowSeconds: 3600,
  },
  orders: {
    max: parseInt(process.env.RATE_LIMIT_ORDERS_PER_DAY ?? '10', 10),
    windowSeconds: 86400,
  },
}

// Simple rate limiter backed by Supabase searches/orders tables.
// For production, consider an in-memory store (Redis/Upstash) for lower latency.
export function rateLimitMiddleware(bucket: BucketType): MiddlewareHandler {
  return async (c, next) => {
    const userId = c.get('userId')
    const limit = LIMITS[bucket]
    const windowStart = new Date(Date.now() - limit.windowSeconds * 1000).toISOString()

    const table = bucket === 'searches' ? 'searches' : 'orders'
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStart)

    if ((count ?? 0) >= limit.max) {
      return c.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: limit.windowSeconds,
        },
        429
      )
    }

    await next()
  }
}
