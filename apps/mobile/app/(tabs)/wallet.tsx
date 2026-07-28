import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ScreenHeader'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/context/ThemeContext'
import { SPEND_LIMITS } from '@/constants/fees'
import { useSpeech } from '@/hooks/useSpeech'
import { parseSpokenAddress } from '@/lib/address'
import { getAddress, saveAddress } from '@/lib/profile-api'
import { supabase } from '@/lib/supabase'

// Module-level so its identity is stable across renders.
const confirmAddressPhrase = (t: string) => `Got it — ${t}. Check it looks right, then save.`

export default function WalletScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [addressText, setAddressText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onTranscript = useCallback((transcript: string) => {
    const parsed = parseSpokenAddress(transcript)
    // Only overwrite what was actually heard — a transcript with no postcode
    // shouldn't wipe one the user already has.
    if (parsed.city) setCity(parsed.city)
    if (parsed.postcode) setPostcode(parsed.postcode)
    setAddressText(parsed.addressText)
    setSaved(false)
    setError(null)
  }, [])

  const { isListening, isProcessing, startListening, stopListening, error: speechError } =
    useSpeech(onTranscript, { confirmPhrase: confirmAddressPhrase })

  useEffect(() => {
    getAddress()
      .then((a) => {
        if (!a) return
        setCity(a.city ?? '')
        setPostcode(a.postcode ?? '')
        setAddressText(a.addressText ?? '')
      })
      .catch(() => {/* first run, or offline — leave the fields empty */})
      .finally(() => setLoading(false))
  }, [])

  const canSave = city.trim().length > 0 && postcode.trim().length > 0 && !saving

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveAddress({
        addressText: addressText.trim() || undefined,
        postcode: postcode.trim(),
        city: city.trim(),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save address')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert('Sign out', 'You’ll need to sign in again to search or buy.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        // _layout.tsx's onAuthStateChange listener routes back to (auth).
        onPress: () => { supabase.auth.signOut().catch(() => {}) },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Wallet" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <View style={styles.balanceCard} accessibilityLabel="Current wallet balance: $842.50 New Zealand dollars">
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balanceAmount}>$842.50</Text>
          <Text style={styles.balanceCurrency}>NZD</Text>
        </View>

        <View style={styles.limitsSection}>
          <Text style={styles.sectionTitle}>Spend limits</Text>
          <LimitRow
            label="Per transaction"
            value={`$${SPEND_LIMITS.defaultPerTransactionNZD}`}
            c={c}
          />
          <LimitRow
            label="Monthly"
            value={`$${SPEND_LIMITS.defaultMonthlyNZD}`}
            c={c}
          />
        </View>

        {/* Delivery area — drives local-first deal broadcast (lib/broadcast.ts) */}
        <View style={styles.limitsSection}>
          <Text style={styles.sectionTitle}>Delivery area</Text>
          <Text style={styles.sectionHint}>
            Tell us where you are and we’ll show you local deals first.
          </Text>

          {loading ? (
            <ActivityIndicator color={c.primary} style={{ marginTop: 16 }} />
          ) : (
            <>
              <Pressable
                onPress={isListening ? stopListening : startListening}
                disabled={isProcessing}
                style={[styles.micBtn, isListening && styles.micBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={isListening ? 'Stop listening' : 'Say your city and postcode'}
              >
                {isProcessing ? (
                  <ActivityIndicator color={c.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons
                      name={isListening ? 'stop' : 'mic'}
                      size={18}
                      color={isListening ? c.textOnPrimary : c.primary}
                    />
                    <Text style={[styles.micBtnText, isListening && styles.micBtnTextActive]}>
                      {isListening ? 'Tap when done' : 'Say your city and postcode'}
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.fieldRow}>
                <View style={styles.fieldCity}>
                  <Text style={styles.fieldLabel}>City</Text>
                  <TextInput
                    value={city}
                    onChangeText={(t) => { setCity(t); setSaved(false) }}
                    placeholder="Wellington"
                    placeholderTextColor={c.textMuted}
                    style={styles.input}
                    accessibilityLabel="City"
                  />
                </View>
                <View style={styles.fieldPostcode}>
                  <Text style={styles.fieldLabel}>Postcode</Text>
                  <TextInput
                    value={postcode}
                    onChangeText={(t) => { setPostcode(t.replace(/\D/g, '').slice(0, 4)); setSaved(false) }}
                    placeholder="6011"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    style={styles.input}
                    accessibilityLabel="Postcode"
                  />
                </View>
              </View>

              {(error || speechError) && (
                <Text style={styles.errorText}>{error ?? speechError}</Text>
              )}
              {saved && !error && <Text style={styles.savedText}>Saved</Text>}

              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={[styles.saveBtn, !canSave && styles.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Save delivery area"
              >
                {saving
                  ? <ActivityIndicator color={c.textOnPrimary} />
                  : <Text style={styles.saveBtnText}>Save</Text>}
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.securityNote} accessibilityLabel="Security note: Your real card number never reaches merchants. taylin.ai uses single-use virtual cards.">
          <Text style={styles.securityText}>
            🔒 Your real card number never reaches merchants.
            {'\n'}taylin.ai uses single-use virtual cards for every purchase.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function LimitRow({ label, value, c }: {
  label: string
  value: string
  c: ReturnType<typeof useTheme>['theme']['colors']
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
      <Text style={{ color: c.textSecondary, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    balanceCard: {
      backgroundColor: c.primary,
      borderRadius: 20,
      padding: 28,
      alignItems: 'center',
      marginBottom: 24,
    },
    balanceLabel: { color: c.textOnPrimary, fontSize: 14, opacity: 0.8, marginBottom: 8 },
    balanceAmount: { color: c.textOnPrimary, fontSize: 48, fontWeight: '800' },
    balanceCurrency: { color: c.textOnPrimary, fontSize: 16, opacity: 0.7, marginTop: 4 },
    limitsSection: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 20,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 },
    sectionHint: { fontSize: 13, color: c.textSecondary, marginBottom: 14, lineHeight: 18 },
    micBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.primary,
      marginBottom: 16,
    },
    micBtnActive: { backgroundColor: c.primary },
    micBtnText: { color: c.primary, fontSize: 15, fontWeight: '600' },
    micBtnTextActive: { color: c.textOnPrimary },
    fieldRow: { flexDirection: 'row', gap: 12 },
    fieldCity: { flex: 2 },
    fieldPostcode: { flex: 1 },
    fieldLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.background,
    },
    errorText: { color: c.error, fontSize: 13, marginTop: 12 },
    savedText: { color: c.success, fontSize: 13, marginTop: 12, fontWeight: '600' },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 16,
    },
    saveBtnText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '700' },
    btnDisabled: { opacity: 0.4 },
    securityNote: {
      backgroundColor: c.success + '20',
      borderRadius: 12,
      padding: 16,
    },
    securityText: { color: c.text, fontSize: 13, lineHeight: 20 },
  })
}
