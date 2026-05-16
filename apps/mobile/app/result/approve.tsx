import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, AccessibilityInfo } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { usePayment } from '@/hooks/usePayment'
import { EscrowBadge } from '@/components/EscrowBadge'

export default function ApproveScreen() {
  const { searchId, productId, amount, sellerTier, productName } =
    useLocalSearchParams<{
      searchId: string
      productId: string
      amount: string
      sellerTier: string
      productName: string
    }>()

  const { theme } = useTheme()
  const c = theme.colors
  const { approvePayment, status } = usePayment()
  const [done, setDone] = useState(false)
  const styles = makeStyles(c)

  const isLoading = ['authenticating', 'issuing', 'ordering'].includes(status)
  const parsedAmount = parseFloat(amount ?? '0')
  const tier = parseInt(sellerTier ?? '2', 10) as 1 | 2 | 3

  const statusMessages: Record<string, string> = {
    authenticating: 'Verifying your identity...',
    issuing: 'Issuing secure payment token...',
    ordering: 'Placing your order...',
  }

  const handleApprove = async () => {
    try {
      await approvePayment({
        searchId: searchId!,
        productId: productId!,
        amount: parsedAmount,
      })
      setDone(true)
      AccessibilityInfo.announceForAccessibility('Order placed successfully. Your purchase is protected.')
    } catch {
      AccessibilityInfo.announceForAccessibility('Payment failed. Please try again.')
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneContainer} accessibilityLabel="Order confirmed. Your purchase is protected by taylin.ai.">
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneTitle}>Order confirmed</Text>
          <Text style={styles.doneDesc}>Your purchase is protected by taylin.ai</Text>
          <Pressable
            style={styles.doneBtn}
            onPress={() => router.replace('/(tabs)/history')}
            accessibilityLabel="View order in history"
            accessibilityRole="button"
          >
            <Text style={styles.doneBtnText}>View in history</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">Confirm purchase</Text>

        <View style={styles.productCard}>
          <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
          <Text style={styles.amount}>${parsedAmount.toFixed(2)} NZD</Text>
          <EscrowBadge tier={tier} />
        </View>

        <View style={styles.securityNote} accessibilityLabel="Payment security information">
          <Text style={styles.securityText}>
            🔒 A single-use virtual card will be created for this purchase.
            {'\n'}Your real card number never reaches the seller.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={c.primary} />
            <Text style={styles.loadingText}>{statusMessages[status]}</Text>
          </View>
        ) : (
          <View style={styles.buttons}>
            <Pressable
              style={styles.confirmBtn}
              onPress={handleApprove}
              accessibilityLabel={`Confirm purchase of ${productName} for $${parsedAmount.toFixed(2)} New Zealand dollars.`}
              accessibilityHint="Biometric authentication will be required"
              accessibilityRole="button"
            >
              <Text style={styles.confirmBtnText}>Pay ${parsedAmount.toFixed(2)}</Text>
            </Pressable>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => router.back()}
              accessibilityLabel="Cancel and go back"
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    container: { flex: 1, padding: 24 },
    title: { fontSize: 26, fontWeight: '700', color: c.text, marginBottom: 20 },
    productCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 16,
      gap: 8,
    },
    productName: { fontSize: 18, fontWeight: '600', color: c.text },
    amount: { fontSize: 32, fontWeight: '800', color: c.primary },
    securityNote: {
      backgroundColor: c.success + '18',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    securityText: { fontSize: 13, color: c.text, lineHeight: 20 },
    buttons: { gap: 12 },
    confirmBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmBtnText: { color: c.textOnPrimary, fontSize: 18, fontWeight: '700' },
    cancelBtn: {
      borderRadius: 16,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.border,
    },
    cancelBtnText: { color: c.textSecondary, fontSize: 16, fontWeight: '600' },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
    loadingText: { color: c.textSecondary, fontSize: 15 },
    doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    doneEmoji: { fontSize: 56 },
    doneTitle: { fontSize: 28, fontWeight: '700', color: c.text, marginTop: 16 },
    doneDesc: { fontSize: 16, color: c.textSecondary, marginTop: 8, textAlign: 'center' },
    doneBtn: {
      marginTop: 32,
      backgroundColor: c.primary,
      borderRadius: 14,
      height: 52,
      paddingHorizontal: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: { color: c.textOnPrimary, fontSize: 16, fontWeight: '700' },
  })
}
