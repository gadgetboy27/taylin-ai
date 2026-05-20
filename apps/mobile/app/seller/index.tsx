import React from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'

const BENEFITS = [
  {
    icon: '🤖',
    title: 'AI puts you in front of buyers',
    body: 'Our AI matches your products to buyer intent — no ads, no algorithms to game.',
  },
  {
    icon: '🔒',
    title: 'Escrow on every sale',
    body: 'Buyers pay into escrow. You get paid when they confirm delivery. No chargebacks.',
  },
  {
    icon: '✅',
    title: '5-minute verification',
    body: 'A quick AI interview instead of a lengthy form. We check online so you don\'t have to submit documents.',
  },
]

export default function SellerLandingScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Pressable
          style={styles.backRow}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Sell on taylin.ai</Text>
          <Text style={styles.heading}>Your shop,{'\n'}found by AI</Text>
          <Text style={styles.subheading}>
            Reach buyers who are already looking for what you sell.
            No listing fees — we take a small commission only when you make a sale.
          </Text>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitCard}>
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <View style={styles.benefitBody}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitText}>{b.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.howItWorks}>
          <Text style={styles.sectionLabel}>How it works</Text>
          <Text style={styles.howStep}><Text style={styles.howNumber}>1</Text>  Quick AI interview — Taylor asks about your business (5 min)</Text>
          <Text style={styles.howStep}><Text style={styles.howNumber}>2</Text>  We verify your details online with your permission</Text>
          <Text style={styles.howStep}><Text style={styles.howNumber}>3</Text>  Your trust tier is set — higher tier = lower fees + more visibility</Text>
          <Text style={styles.howStep}><Text style={styles.howNumber}>4</Text>  List your products and start selling</Text>
        </View>

      </ScrollView>

      <View style={styles.ctaWrapper}>
        <Pressable
          style={styles.ctaBtn}
          onPress={() => router.push('/seller/apply')}
          accessibilityRole="button"
          accessibilityLabel="Start the seller interview"
        >
          <Text style={styles.ctaText}>Start the interview →</Text>
        </Pressable>
        <Text style={styles.ctaNote}>Takes about 5 minutes · Free · No documents needed</Text>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingBottom: 24 },

    backRow: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
    backText: { color: c.accent, fontSize: 16 },

    hero: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
    eyebrow: {
      fontSize: 13,
      fontWeight: '600',
      color: c.accent,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
    },
    heading: {
      fontSize: 38,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -1,
      lineHeight: 44,
      marginBottom: 16,
    },
    subheading: {
      fontSize: 16,
      color: c.textSecondary,
      lineHeight: 24,
    },

    benefits: { paddingHorizontal: 16, gap: 10, marginBottom: 28 },
    benefitCard: {
      flexDirection: 'row',
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      alignItems: 'flex-start',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: { elevation: 1 },
      }),
    },
    benefitIcon: { fontSize: 24, lineHeight: 30 },
    benefitBody: { flex: 1 },
    benefitTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 },
    benefitText: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },

    howItWorks: { paddingHorizontal: 24, marginBottom: 16 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 14,
    },
    howStep: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 22,
      marginBottom: 8,
    },
    howNumber: { fontWeight: '700', color: c.primary },

    ctaWrapper: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      backgroundColor: c.background,
      alignItems: 'center',
    },
    ctaBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      width: '100%',
      marginBottom: 8,
    },
    ctaText: {
      color: c.textOnPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    ctaNote: {
      fontSize: 12,
      color: c.textMuted,
      textAlign: 'center',
    },
  })
}
