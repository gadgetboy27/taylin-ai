import { supabase } from './supabase.js'

type FraudCheckResult = { pass: boolean; reason?: string }

// Pre-flight fraud checks before issuing any payment token
export async function runFraudChecks(params: {
  userId: string
  amount: number
  sellerId: string
}): Promise<FraudCheckResult> {
  // Check spend limits
  const { data: user } = await supabase
    .from('users')
    .select('spend_limit_per_tx, spend_limit_monthly')
    .eq('id', params.userId)
    .single()

  if (!user) return { pass: false, reason: 'User not found' }

  if (params.amount > user.spend_limit_per_tx) {
    return {
      pass: false,
      reason: `Amount exceeds per-transaction limit of $${user.spend_limit_per_tx}`,
    }
  }

  // Check monthly spend
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: monthOrders } = await supabase
    .from('orders')
    .select('amount')
    .eq('user_id', params.userId)
    .gte('created_at', startOfMonth.toISOString())
    .not('status', 'in', '("refunded","disputed")')

  const monthlyTotal = (monthOrders ?? []).reduce((sum, o) => sum + o.amount, 0)

  if (monthlyTotal + params.amount > user.spend_limit_monthly) {
    return {
      pass: false,
      reason: 'Monthly spend limit would be exceeded',
    }
  }

  return { pass: true }
}
