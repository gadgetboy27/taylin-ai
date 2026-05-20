import { useCallback, useState } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL

export type PaymentStatus = 'idle' | 'authenticating' | 'issuing' | 'ordering' | 'done' | 'error'

export function usePayment() {
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const approvePayment = useCallback(async (params: {
    searchId: string
    productId: string
    amount: number
  }): Promise<{ orderId: string }> => {
    setStatus('authenticating')
    setError(null)

    // Biometric gate — skipped on web (no native biometric API)
    if (Platform.OS !== 'web') {
      const biometricResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm payment with Face ID or Touch ID',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
      })
      if (!biometricResult.success) {
        setStatus('error')
        setError('Authentication cancelled')
        throw new Error('Authentication cancelled')
      }
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    }

    // Issue scoped single-use card token
    setStatus('issuing')
    const tokenRes = await fetch(`${API_URL}/token`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: params.amount, searchId: params.searchId }),
    })

    if (!tokenRes.ok) {
      setStatus('error')
      setError('Could not issue payment token')
      throw new Error('Token issue failed')
    }

    const { tokenId } = await tokenRes.json() as { tokenId: string }

    // Place order
    setStatus('ordering')
    const orderRes = await fetch(`${API_URL}/order`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        searchId: params.searchId,
        productId: params.productId,
        tokenId,
        amount: params.amount,
      }),
    })

    if (!orderRes.ok) {
      setStatus('error')
      setError('Order placement failed')
      throw new Error('Order failed')
    }

    const { orderId } = await orderRes.json() as { orderId: string }
    setStatus('done')
    return { orderId }
  }, [])

  return { approvePayment, status, error }
}
