import { supabase } from './supabase'

export type SignalType = 'purchase' | 'view' | 'skip' | 'return' | 'sponsor_ignored'

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  purchase: 1.0,
  view: 0.2,
  skip: -0.3,
  return: -0.8,
  sponsor_ignored: -0.1,
}

export async function recordSignal(
  userId: string,
  category: string,
  product: {
    name: string
    attributes: string[]
    seller: string
    price: number
  },
  signal: SignalType
): Promise<void> {
  const weight = SIGNAL_WEIGHTS[signal]
  const signalText = `${product.name} ${product.attributes.join(' ')} ${product.seller}`

  const { data: existing } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .single()

  if (weight > 0) {
    const positiveSignals = [...(existing?.positive_signals || []), signalText].slice(-50)
    await supabase.from('preferences').upsert(
      {
        user_id: userId,
        category,
        positive_signals: positiveSignals,
        negative_signals: existing?.negative_signals || [],
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id,category' }
    )
  } else {
    const negativeSignals = [...(existing?.negative_signals || []), signalText].slice(-30)
    await supabase.from('preferences').upsert(
      {
        user_id: userId,
        category,
        positive_signals: existing?.positive_signals || [],
        negative_signals: negativeSignals,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id,category' }
    )
  }
}

export async function loadPreferences(userId: string, category?: string) {
  let query = supabase
    .from('preferences')
    .select('*')
    .eq('user_id', userId)

  if (category) query = query.eq('category', category)

  const { data } = await query
  return data || []
}
