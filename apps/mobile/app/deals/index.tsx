import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { listDeals, claimDeal, type Deal } from '@/lib/deals-api'

export default function DealsScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [deals, setDeals] = useState<Deal[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setDeals(await listDeals())
    } catch {
      // leave the previous list showing rather than blanking on a transient failure
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleClaim = async (dealId: string) => {
    setClaimingId(dealId)
    try {
      await claimDeal(dealId)
      await refresh()
    } catch {
      // silent — the button re-enables and the list refresh will show current state
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">Local deals</Text>
      </View>

      <FlatList
        data={deals}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No deals nearby right now — check back soon.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.sellers?.business_name && (
                <Text style={styles.cardSeller}>
                  {item.sellers.business_name}{item.sellers.city ? ` · ${item.sellers.city}` : ''}
                </Text>
              )}
              <Text style={styles.cardMeta}>
                {item.currency} {item.price.toFixed(2)} · {item.quantity_remaining} left
              </Text>
            </View>
            <Pressable
              style={[styles.claimBtn, claimingId === item.id && styles.claimBtnDisabled]}
              onPress={() => handleClaim(item.id)}
              disabled={claimingId === item.id}
              accessibilityRole="button"
              accessibilityLabel={`Claim ${item.title}`}
            >
              <Text style={styles.claimBtnText}>Claim</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 },
    backText: { color: c.accent, fontSize: 16 },
    title: { fontSize: 24, fontWeight: '800', color: c.text },

    list: { padding: 16, gap: 10 },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: 40, fontSize: 14 },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    cardBody: { flex: 1, gap: 4 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    cardSeller: { fontSize: 13, color: c.textSecondary },
    cardMeta: { fontSize: 13, color: c.textMuted },

    claimBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
    claimBtnDisabled: { opacity: 0.5 },
    claimBtnText: { color: c.textOnPrimary, fontSize: 14, fontWeight: '700' },
  })
}
