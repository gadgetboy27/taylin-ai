import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/context/ThemeContext'
import { matchLocalityByPostcode, matchLocalityByName } from '@/lib/nz-localities'
import type { Deal } from '@/lib/deals-api'

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY

export type PlacedDeal = Deal & { lat: number; lng: number; placeName: string }

/**
 * Resolve deals to coordinates offline.
 *
 * Sellers have no lat/lng — 014_geo.sql declined them deliberately — so pins
 * come from postcode (or suburb/city) via lib/nz-localities. That means a pin
 * sits at the locality centre, not a street address, which is the honest
 * precision here: many sellers trade from home, and dropping an exact dot on
 * someone's house is a privacy problem rather than a feature.
 */
export function placeDeals(deals: Deal[]): PlacedDeal[] {
  const out: PlacedDeal[] = []
  for (const d of deals) {
    const s = d.sellers
    if (!s) continue
    const loc =
      (s.postcode && matchLocalityByPostcode(s.postcode)) ||
      (s.suburb && matchLocalityByName(s.suburb)) ||
      (s.city && matchLocalityByName(s.city)) ||
      null
    if (!loc) continue
    out.push({ ...d, lat: loc.lat, lng: loc.lng, placeName: loc.suburb })
  }
  return out
}

/**
 * Floating map card. maplibre-gl is imported dynamically on open so its ~230KB
 * never lands in the initial bundle — the reason this is a card rather than a
 * permanent half-screen map.
 */
export function DealsMap({ deals, onClose, onSelect }: {
  deals: Deal[]
  onClose: () => void
  onSelect: (dealId: string) => void
}) {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const containerRef = useRef<View | null>(null)
  const mapRef = useRef<{ remove: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const placed = placeDeals(deals)

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setError('The map is web-only for now')
      setLoading(false)
      return
    }
    if (!MAPTILER_KEY) {
      setError('Map not configured — add EXPO_PUBLIC_MAPTILER_KEY')
      setLoading(false)
      return
    }
    if (placed.length === 0) {
      setError('No deals with a known location yet')
      setLoading(false)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const maplibre = await import('maplibre-gl')
        // Web-only: react-native-web renders this View to a real DOM node,
        // which is what maplibre needs as its container.
        const el = containerRef.current as unknown as HTMLElement | null
        if (!el || cancelled) return

        const map = new maplibre.Map({
          container: el,
          style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
          center: [placed[0].lng, placed[0].lat],
          zoom: 6,
          attributionControl: { compact: true },
        })
        mapRef.current = map as unknown as { remove: () => void }

        map.on('load', () => {
          if (cancelled) return
          setLoading(false)

          // Group by locality: several sellers in one town would otherwise
          // stack invisible pins on the same coordinate.
          const byPlace = new Map<string, PlacedDeal[]>()
          for (const d of placed) {
            const k = `${d.lat},${d.lng}`
            byPlace.set(k, [...(byPlace.get(k) ?? []), d])
          }

          for (const group of byPlace.values()) {
            const first = group[0]
            const marker = document.createElement('div')
            marker.style.cssText = `
              background:${c.primary};color:${c.textOnPrimary};border-radius:14px;
              padding:4px 9px;font:600 12px system-ui;cursor:pointer;white-space:nowrap;
              box-shadow:0 2px 8px rgba(0,0,0,.25)`
            marker.textContent = group.length > 1
              ? `${first.placeName} · ${group.length}`
              : first.placeName
            marker.onclick = () => onSelect(first.id)
            new maplibre.Marker({ element: marker })
              .setLngLat([first.lng, first.lat])
              .addTo(map)
          }

          if (placed.length > 1) {
            const b = new maplibre.LngLatBounds()
            placed.forEach((d) => b.extend([d.lng, d.lat]))
            map.fitBounds(b, { padding: 56, maxZoom: 11, duration: 0 })
          }
        })

        map.on('error', () => {
          if (!cancelled) { setError('Map failed to load'); setLoading(false) }
        })
      } catch {
        if (!cancelled) { setError('Could not load the map'); setLoading(false) }
      }
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // placed is derived from deals; re-running on every render would rebuild the map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals.length])

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {placed.length} deal{placed.length === 1 ? '' : 's'} near you
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close map">
            <Ionicons name="close" size={20} color={c.textMuted} />
          </Pressable>
        </View>

        <View style={styles.mapWrap}>
          <View ref={containerRef} style={styles.map} />
          {(loading || error) && (
            <View style={styles.state}>
              {error
                ? <Text style={styles.stateText}>{error}</Text>
                : <ActivityIndicator color={c.primary} />}
            </View>
          )}
        </View>

        <Text style={styles.note}>Pins show the seller's town, not their street address.</Text>
      </View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      zIndex: 20,
    },
    card: {
      width: '100%',
      maxWidth: 560,
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    title: { fontSize: 15, fontWeight: '700', color: c.text },
    mapWrap: { height: 340, backgroundColor: c.background },
    map: { flex: 1 },
    state: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24 },
    stateText: { fontSize: 13, color: c.textSecondary, textAlign: 'center' },
    note: { fontSize: 11, color: c.textMuted, paddingHorizontal: 16, paddingVertical: 10 },
  })
}
