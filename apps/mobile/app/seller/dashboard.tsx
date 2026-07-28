import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Linking, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ScreenHeader'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { getMySellerProfile, type SellerProfile } from '@/lib/seller-api'
import { startConnectOnboarding, syncConnectStatus } from '@/lib/connect-api'

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

  const [connectBusy, setConnectBusy] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [outstanding, setOutstanding] = useState<string[]>([])

  useEffect(() => {
    getMySellerProfile()
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  // Stripe sends the seller back here after onboarding, so check on every mount
  // rather than only on button press — otherwise a seller who completed the
  // checks would still see "not verified" until they thought to press it.
  const refreshVerification = useCallback(async () => {
    setConnectError(null)
    try {
      const status = await syncConnectStatus()
      setOutstanding(status.outstanding)
      setProfile((p) => p && {
        ...p,
        identity_verified: status.identityVerified,
        trust_tier: status.trustTier,
      })
    } catch {
      // No Stripe account yet is the normal case before onboarding — not worth
      // showing as an error.
    }
  }, [])

  useEffect(() => {
    if (profile && !profile.identity_verified) void refreshVerification()
  }, [profile?.id, profile?.identity_verified, refreshVerification])

  const handleVerify = useCallback(async () => {
    setConnectBusy(true)
    setConnectError(null)
    try {
      const url = await startConnectOnboarding()
      if (Platform.OS === 'web') {
        // Same tab: Stripe returns to /seller/dashboard, where the mount effect
        // above picks the result up.
        window.location.href = url
      } else {
        await Linking.openURL(url)
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Could not start verification')
    } finally {
      setConnectBusy(false)
    }
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
      <ScreenHeader title="Your shop" back />
      <ScrollView contentContainerStyle={styles.scroll}>
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

        {/* Verification. Framed around getting paid rather than "KYC", because
            that's the thing the seller actually wants — the identity check is a
            by-product of setting up payouts, not a hurdle we're imposing. */}
        {profile.identity_verified ? (
          <View style={styles.verifiedCard}>
            <Text style={styles.verifiedTitle}>✓ Identity verified</Text>
            <Text style={styles.verifiedBody}>
              You're set up for payouts, and verified sellers rank higher in search.
            </Text>
          </View>
        ) : (
          <View style={styles.verifyCard}>
            <Text style={styles.verifyTitle}>Get paid & get verified</Text>
            <Text style={styles.verifyBody}>
              Set up payouts with Stripe. It verifies your identity at the same time,
              which lowers your fees and lifts you up the search results.
              No business registration needed.
            </Text>

            {outstanding.length > 0 && (
              <Text style={styles.verifyOutstanding}>
                Stripe still needs: {outstanding.join(', ')}
              </Text>
            )}
            {connectError && <Text style={styles.verifyError}>{connectError}</Text>}

            <Pressable
              style={[styles.verifyBtn, connectBusy && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={connectBusy}
              accessibilityRole="button"
              accessibilityLabel="Set up payouts and verify your identity with Stripe"
            >
              {connectBusy
                ? <ActivityIndicator color={c.textOnPrimary} />
                : <Text style={styles.verifyBtnText}>
                    {outstanding.length > 0 ? 'Finish verification →' : 'Set up payouts →'}
                  </Text>}
            </Pressable>
          </View>
        )}

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

    verifyCard: {
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderRadius: 16,
      padding: 20,
      marginTop: 24,
      gap: 10,
    },
    verifyTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    verifyBody: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
    verifyOutstanding: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
    verifyError: { fontSize: 13, color: c.error },
    verifyBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    verifyBtnText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '700' },
    btnDisabled: { opacity: 0.5 },

    verifiedCard: {
      backgroundColor: c.success + '18',
      borderRadius: 16,
      padding: 18,
      marginTop: 24,
      gap: 6,
    },
    verifiedTitle: { fontSize: 15, fontWeight: '700', color: c.success },
    verifiedBody: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },

    dealBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    dealBtnText: { color: c.textOnPrimary, fontSize: 16, fontWeight: '700' },
  })
}
