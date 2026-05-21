import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  type TextInput as TextInputType,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/context/ThemeContext'
import { ThemeSelector } from '@/components/ThemeSelector'
import { supabase } from '@/lib/supabase'
import { cardShadow } from '@/lib/styles'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

type Step = 'phone' | 'code'

export default function SignInScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const codeRef = useRef<TextInputType>(null)

  const sendCode = useCallback(async () => {
    const trimmed = phone.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/auth/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed }),
      })
      const data = await res.json() as { sent?: boolean; error?: string; devCode?: string }

      if (!res.ok || data.error) {
        setError(data.error ?? 'Could not send code — try again.')
        return
      }

      // Dev mode: code comes back in the response, pre-fill it
      if (data.devCode) setCode(data.devCode)

      setStep('code')
      setTimeout(() => codeRef.current?.focus(), 300)
    } catch {
      setError('Could not reach the server. Is the API running?')
    } finally {
      setLoading(false)
    }
  }, [phone])

  const verifyCode = useCallback(async () => {
    const trimmed = code.trim()
    if (trimmed.length !== 6) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/auth/sms/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: trimmed }),
      })
      const data = await res.json() as {
        verified?: boolean
        email: string
        token: string
        error?: string
      }

      if (!res.ok || data.error) {
        setError(data.error ?? 'Verification failed — try again.')
        return
      }

      // Exchange the admin-issued token for a real Supabase session
      const { error: supaErr } = await supabase.auth.verifyOtp({
        email: data.email,
        token: data.token,
        type: 'email',
      })
      if (supaErr) {
        setError(supaErr.message)
        return
      }
      // _layout.tsx auth listener handles navigation to (tabs)
    } catch {
      setError('Could not reach the server. Is the API running?')
    } finally {
      setLoading(false)
    }
  }, [phone, code])

  const goBack = useCallback(() => {
    setStep('phone')
    setCode('')
    setError(null)
  }, [])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.topBar}>
          <ThemeSelector />
        </View>

        <View style={styles.content}>
          <Text style={styles.wordmark}>taylin.ai</Text>
          <Text style={styles.tagline}>Find it. Verify it. Protect it.</Text>

          <View style={[styles.card, cardShadow]}>
            {step === 'phone' ? (
              <>
                <Text style={styles.cardTitle}>Sign in</Text>
                <Text style={styles.cardSub}>Enter your mobile number — we'll text you a code.</Text>

                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(t) => { setPhone(t); setError(null) }}
                  placeholder="+64 21 123 4567"
                  placeholderTextColor={c.textMuted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  returnKeyType="send"
                  onSubmitEditing={sendCode}
                  editable={!loading}
                  autoFocus
                />

                {error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable
                  style={[styles.btn, (!phone.trim() || loading) && styles.btnDisabled]}
                  onPress={sendCode}
                  disabled={!phone.trim() || loading}
                  accessibilityRole="button"
                >
                  {loading
                    ? <ActivityIndicator color={c.textOnPrimary} />
                    : <Text style={styles.btnText}>Send code</Text>
                  }
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={goBack} style={styles.backRow} accessibilityRole="button">
                  <Text style={styles.backText}>← {phone}</Text>
                </Pressable>

                <Text style={styles.cardTitle}>Check your messages</Text>
                <Text style={styles.cardSub}>Enter the 6-digit code we sent.</Text>

                <TextInput
                  ref={codeRef}
                  style={[styles.input, styles.codeInput]}
                  value={code}
                  onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(null) }}
                  placeholder="000000"
                  placeholderTextColor={c.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  returnKeyType="done"
                  onSubmitEditing={verifyCode}
                  editable={!loading}
                />

                {error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable
                  style={[styles.btn, (code.length < 6 || loading) && styles.btnDisabled]}
                  onPress={verifyCode}
                  disabled={code.length < 6 || loading}
                  accessibilityRole="button"
                >
                  {loading
                    ? <ActivityIndicator color={c.textOnPrimary} />
                    : <Text style={styles.btnText}>Verify</Text>
                  }
                </Pressable>

                <Pressable
                  style={styles.resendRow}
                  onPress={sendCode}
                  disabled={loading}
                  accessibilityRole="button"
                >
                  <Text style={styles.resendText}>Resend code</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <Text style={styles.legal}>
          By continuing you agree to our Terms &amp; Privacy Policy.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    kav: { flex: 1 },
    topBar: { paddingHorizontal: 20, paddingTop: 12, alignItems: 'flex-end' },
    content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 8 },

    wordmark: { fontSize: 40, fontWeight: '800', color: c.text, letterSpacing: -1.5, textAlign: 'center' },
    tagline: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginBottom: 24 },

    card: {
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderRadius: 24,
      padding: 24,
      gap: 12,
    },
    cardTitle: { fontSize: 22, fontWeight: '700', color: c.text },
    cardSub: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 4 },

    input: {
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.glassBorder,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: c.text,
    },
    codeInput: { fontSize: 30, fontWeight: '700', letterSpacing: 10, textAlign: 'center', paddingVertical: 16 },

    btn: { backgroundColor: c.primary, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: c.textOnPrimary, fontSize: 16, fontWeight: '700' },

    errorText: { fontSize: 13, color: c.error, textAlign: 'center' },
    backRow: { marginBottom: 4 },
    backText: { fontSize: 13, color: c.accent },
    resendRow: { alignItems: 'center', paddingVertical: 4 },
    resendText: { fontSize: 13, color: c.textMuted },

    legal: { fontSize: 11, color: c.textMuted, textAlign: 'center', paddingHorizontal: 32, paddingBottom: 16, lineHeight: 16 },
  })
}
