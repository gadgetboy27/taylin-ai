import { supabase } from './supabase'

export type EscrowStatus =
  | 'pending'
  | 'escrowed'
  | 'shipped'
  | 'delivered'
  | 'disputed'
  | 'released'
  | 'refunded'

export async function getOrderStatus(orderId: string): Promise<EscrowStatus | null> {
  const { data } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()

  return (data?.status as EscrowStatus) || null
}

export async function confirmDelivery(orderId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'delivered',
      buyer_confirmed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('user_id', user.id)

  if (error) throw error
}

export async function disputeOrder(orderId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('orders')
    .update({ status: 'disputed' })
    .eq('id', orderId)
    .eq('user_id', user.id)

  if (error) throw error
}
