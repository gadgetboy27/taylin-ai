import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/context/ThemeContext'
import { SPEND_LIMITS } from '@/constants/fees'

export default function WalletScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Wallet
        </Text>

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

        <View style={styles.securityNote} accessibilityLabel="Security note: Your real card number never reaches merchants. taylin.ai uses single-use virtual cards.">
          <Text style={styles.securityText}>
            🔒 Your real card number never reaches merchants.
            {'\n'}taylin.ai uses single-use virtual cards for every purchase.
          </Text>
        </View>
      </View>
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
    container: { flex: 1, padding: 20 },
    title: { fontSize: 28, fontWeight: '700', color: c.text, marginBottom: 20 },
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
    securityNote: {
      backgroundColor: c.success + '20',
      borderRadius: 12,
      padding: 16,
    },
    securityText: { color: c.text, fontSize: 13, lineHeight: 20 },
  })
}
