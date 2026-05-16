import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, AccessibilityInfo,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'

type Step = 'phone' | 'otp'

export default function VerifyScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  const sendOtp = async () => {
    if (!phone.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    setStep('otp')
    AccessibilityInfo.announceForAccessibility('Verification code sent. Check your messages.')
  }

  const verifyOtp = async () => {
    if (!otp.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: otp.trim(),
      type: 'sms',
    })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    router.replace('/(tabs)')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title} accessibilityRole="header">
          {step === 'phone' ? 'Enter your number' : 'Enter the code'}
        </Text>
        <Text style={styles.desc}>
          {step === 'phone'
            ? 'We\'ll send a one-time code. No spam, ever.'
            : `Code sent to ${phone}`}
        </Text>

        {step === 'phone' ? (
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+64 21 123 4567"
            placeholderTextColor={c.textMuted}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            accessibilityLabel="Phone number input"
            accessibilityHint="Enter your mobile number including country code"
          />
        ) : (
          <TextInput
            style={[styles.input, styles.otpInput]}
            value={otp}
            onChangeText={setOtp}
            placeholder="000000"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            accessibilityLabel="Verification code input"
            accessibilityHint="Enter the 6-digit code from your text message"
          />
        )}

        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={step === 'phone' ? sendOtp : verifyOtp}
          disabled={loading}
          accessibilityLabel={step === 'phone' ? 'Send verification code' : 'Verify code'}
          accessibilityRole="button"
          accessibilityState={{ busy: loading, disabled: loading }}
        >
          <Text style={styles.btnText}>
            {loading ? 'Please wait...' : step === 'phone' ? 'Send code' : 'Verify'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    container: { flex: 1, padding: 24 },
    back: { marginBottom: 32, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    backText: { color: c.accent, fontSize: 16 },
    title: { fontSize: 28, fontWeight: '700', color: c.text, marginBottom: 8 },
    desc: { fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22 },
    input: {
      backgroundColor: c.promptBg,
      borderWidth: 1.5,
      borderColor: c.promptBorder,
      borderRadius: 14,
      padding: 18,
      fontSize: 17,
      color: c.text,
      marginBottom: 16,
    },
    otpInput: {
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: 8,
      textAlign: 'center',
    },
    btn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: c.textOnPrimary, fontSize: 17, fontWeight: '700' },
  })
}
