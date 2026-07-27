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
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { supabase } from '@/lib/supabase'
import { cardShadow } from '@/lib/styles'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
const googleConfigured = !!GOOGLE_WEB_CLIENT_ID

// Configure once at module load rather than per-render. webClientId is the
// audience the returned ID token is minted for, which is what Supabase
// validates — iosClientId only identifies the app to Google on iOS.
if (googleConfigured) {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  })
}

type Step = 'choose' | 'phone' | 'code'

export default function SignInScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  // Falls straight through to the phone flow when Google isn't configured, so
  // a missing client ID degrades to the old behaviour rather than a dead end.
  const [step, setStep] = useState<Step>(googleConfigured ? 'choose' : 'phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const codeRef = useRef<TextInputType>(null)

  const signInWithGoogle = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await GoogleSignin.hasPlayServices()
      const result = await GoogleSignin.signIn()

      // v16 returns a discriminated result — a cancel isn't a failure, so it
      // shouldn't surface an error message.
      if (result.type !== 'success') return

      const idToken = result.data.idToken
      if (!idToken) throw new Error('Google did not return an ID token')

      const { error: supaErr } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      })
      if (supaErr) throw supaErr
      // _layout.tsx auth listener handles navigation to (tabs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in with Google')
    } finally {
      setLoading(false)
    }
  }, [])

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
            {step === 'choose' ? (
              <>
                <Text style={styles.cardTitle}>Sign in</Text>
                <Text style={styles.cardSub}>One tap — no code to type.</Text>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable
                  style={[styles.googleBtn, loading && styles.btnDisabled]}
                  onPress={signInWithGoogle}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                >
                  {loading
                    ? <ActivityIndicator color={c.text} />
                    : <Text style={styles.googleBtnText}>Continue with Google</Text>
                  }
                </Pressable>

                <Pressable
                  style={styles.altRow}
                  onPress={() => { setStep('phone'); setError(null) }}
                  disabled={loading}
                  accessibilityRole="button"
                >
                  <Text style={styles.altText}>Use a phone number instead</Text>
                </Pressable>
              </>
            ) : step === 'phone' ? (
              <>
                {googleConfigured && (
                  <Pressable
                    onPress={() => { setStep('choose'); setError(null) }}
                    style={styles.backRow}
                    accessibilityRole="button"
                  >
                    <Text style={styles.backText}>← Back</Text>
                  </Pressable>
                )}

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

    // Neutral surface rather than c.primary — Google's branding guidelines
    // require their button keep its own light/dark treatment, not the app's
    // accent colour.
    googleBtn: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.glassBorder,
      borderRadius: 14,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    googleBtnText: { color: c.text, fontSize: 16, fontWeight: '600' },
    altRow: { alignItems: 'center', paddingVertical: 8 },
    altText: { fontSize: 13, color: c.textMuted },

    errorText: { fontSize: 13, color: c.error, textAlign: 'center' },
    backRow: { marginBottom: 4 },
    backText: { fontSize: 13, color: c.accent },
    resendRow: { alignItems: 'center', paddingVertical: 4 },
    resendText: { fontSize: 13, color: c.textMuted },

    legal: { fontSize: 11, color: c.textMuted, textAlign: 'center', paddingHorizontal: 32, paddingBottom: 16, lineHeight: 16 },
  })
}
