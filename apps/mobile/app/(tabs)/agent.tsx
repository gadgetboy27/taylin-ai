import React from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ScreenHeader'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'

const HOW_IT_WORKS = [
  'A short chat with Taylor about your business — about 5 minutes.',
  'We check your details online, so there are no documents to upload.',
  'Your trust tier is set: higher tier means lower fees and more visibility.',
  'Your products get listed and buyers start finding you.',
]

export default function AgentScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Your agent" subtitle="Preferences and selling" />
      <ScrollView contentContainerStyle={styles.container}>

        {/* Straight into the interview — the /seller landing page sat between
            here and the only action on it, so it cost a tap without adding
            anything a returning seller needs. Its pitch is still reachable
            below for anyone deciding. */}
        <Pressable
          style={styles.sellerCard}
          onPress={() => router.push('/seller/apply')}
          accessibilityRole="button"
          accessibilityLabel="Start or resume your seller interview"
        >
          <View style={styles.sellerCardBody}>
            <Text style={styles.sellerTitle}>Sell on taylin.ai</Text>
            <Text style={styles.sellerDesc}>
              A short chat with Taylor and your shop is listed.
            </Text>
          </View>
          <Text style={styles.sellerArrow}>→</Text>
        </Pressable>

        {/* The pitch inline rather than behind a tap — it's four lines, and a
            page of its own only delayed the one action on it. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How it works</Text>
          {HOW_IT_WORKS.map((step, i) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    container: { padding: 20, paddingBottom: 40 },
    section: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 16,
    },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 6 },
    sellerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.primary,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    },
    stepRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
    stepNumber: {
      fontSize: 13,
      fontWeight: '700',
      color: c.primary,
      width: 16,
      lineHeight: 19,
    },
    stepText: { fontSize: 14, color: c.textSecondary, lineHeight: 19, flexShrink: 1 },
    sellerCardBody: { flexShrink: 1 },
    sellerTitle: { fontSize: 16, fontWeight: '700', color: c.textOnPrimary, marginBottom: 4 },
    sellerDesc: { fontSize: 13, color: c.textOnPrimary, opacity: 0.8, lineHeight: 18 },
    sellerArrow: { fontSize: 20, color: c.textOnPrimary },
  })
}
