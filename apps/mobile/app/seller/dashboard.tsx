import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { getMySellerProfile, type SellerProfile } from '@/lib/seller-api'

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Verified retailer',
  2: 'Marketplace seller',
  3: 'Individual seller',
}

export default function SellerDashboardScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getMySellerProfile()
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            {error ? "Couldn't load your seller profile" : 'No seller profile yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {error
              ? 'Please try again in a moment.'
              : "You haven't completed the seller interview yet."}
          </Text>
          {!error && (
            <Pressable style={styles.ctaBtn} onPress={() => router.push('/seller/apply')}>
              <Text style={styles.ctaText}>Start the interview →</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>Your shop</Text>
        <Text style={styles.heading}>{profile.business_name}</Text>
        <Text style={styles.tierBadge}>{TIER_LABEL[profile.trust_tier]}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.total_orders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.gst_registered ? 'Yes' : 'No'}</Text>
            <Text style={styles.statLabel}>GST registered</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.identity_verified ? 'Yes' : 'No'}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>

        <Pressable style={styles.dealBtn} onPress={() => router.push('/seller/post-deal')}>
          <Text style={styles.dealBtnText}>Post a deal →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'center' },
    emptyBody: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },

    scroll: { padding: 24 },
    eyebrow: {
      fontSize: 13, fontWeight: '600', color: c.accent,
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
    },
    heading: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 8 },
    tierBadge: { fontSize: 14, color: c.textSecondary, marginBottom: 24 },

    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: {
      flex: 1, backgroundColor: c.glassBackground, borderWidth: 1, borderColor: c.glassBorder,
      borderRadius: 14, padding: 14, alignItems: 'center', gap: 4,
    },
    statValue: { fontSize: 20, fontWeight: '700', color: c.text },
    statLabel: { fontSize: 11, color: c.textMuted, textAlign: 'center' },

    ctaBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 },
    ctaText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '700' },

    dealBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    dealBtnText: { color: c.textOnPrimary, fontSize: 16, fontWeight: '700' },
  })
}
