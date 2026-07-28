import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ScreenHeader'
import { Ionicons } from '@expo/vector-icons'
import { DealsMap, placeDeals } from '@/components/DealsMap'
import { getAddress } from '@/lib/profile-api'
import {
  matchLocalityByPostcode, matchLocalityByName, distanceKm, describeDistance,
  type Locality,
} from '@/lib/nz-localities'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { listDeals, claimDeal, type Deal } from '@/lib/deals-api'

export default function DealsScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [deals, setDeals] = useState<Deal[]>([])
  const [mapOpen, setMapOpen] = useState(false)

  // Buyer locality, so each deal can show how far away it is. Resolved once —
  // the distance itself is arithmetic against the offline table, no lookups.
  const [me, setMe] = useState<Locality | null>(null)
  useEffect(() => {
    getAddress()
      .then((a) => {
        if (!a) return
        setMe(
          (a.postcode && matchLocalityByPostcode(a.postcode)) ||
          (a.suburb && matchLocalityByName(a.suburb)) ||
          (a.city && matchLocalityByName(a.city)) || null
        )
      })
      .catch(() => {/* no address on file — deals just won't show a distance */})
  }, [])
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
      <ScreenHeader
        title="Local deals"
        back
        right={
          placeDeals(deals).length > 0 ? (
            <Pressable
              style={styles.mapChip}
              onPress={() => setMapOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${placeDeals(deals).length} deals on a map`}
            >
              <Ionicons name="map-outline" size={14} color={c.text} />
              <Text style={styles.mapChipText}>Map</Text>
            </Pressable>
          ) : null
        }
      />

      {mapOpen && (
        <DealsMap
          deals={deals}
          onClose={() => setMapOpen(false)}
          onSelect={() => setMapOpen(false)}
        />
      )}

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
              {(() => {
                if (!me) return null
                const s = item.sellers
                const there =
                  (s?.postcode && matchLocalityByPostcode(s.postcode)) ||
                  (s?.suburb && matchLocalityByName(s.suburb)) ||
                  (s?.city && matchLocalityByName(s.city)) || null
                if (!there) return null
                return (
                  <Text style={styles.cardDistance}>
                    {describeDistance(distanceKm(me, there)).label}
                  </Text>
                )
              })()}
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
    cardDistance: { fontSize: 12, color: c.accent, marginTop: 3, fontWeight: '600' },
    mapChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    mapChipText: { fontSize: 13, color: c.text, fontWeight: '600' },
    safe: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 },
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
