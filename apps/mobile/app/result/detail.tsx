import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { EscrowBadge } from '@/components/EscrowBadge'
import { getProduct } from '@/lib/product-store'
import { cardShadow } from '@/lib/styles'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const SOURCE_LABEL: Record<string, string> = {
  ebay: 'eBay',
  trademe: 'Trade Me',
  web: 'Web',
  amadeus: 'Flights',
  aliexpress: 'AliExpress',
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const product = getProduct(id ?? '')
  const [imageIndex, setImageIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backBtn}>← Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.errorText}>Product not found.</Text>
        </View>
      </SafeAreaView>
    )
  }

  const images = product.images?.length ? product.images : []
  const isExternal = !!product.source
  const sourceLabel = product.source ? SOURCE_LABEL[product.source] ?? product.source : 'Taylin'
  const currency = product.currency ?? 'NZD'
  const tier = product.sellerTier ?? 2

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    setImageIndex(idx)
  }

  const handleBuy = () => {
    if (isExternal && product.url) {
      Linking.openURL(product.url)
    } else {
      router.push({
        pathname: '/result/approve',
        params: {
          searchId: product.searchId,
          productId: product.id,
          amount: product.price != null ? String(product.price) : '0',
          sellerTier: String(tier),
          productName: product.name,
        },
      })
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Back */}
      <View style={styles.backRow}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backBtn}>← Back</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Image gallery */}
        {images.length > 0 ? (
          <View style={styles.galleryContainer}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              style={styles.gallery}
            >
              {images.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={styles.galleryImage}
                  resizeMode="contain"
                  accessibilityLabel={`Product image ${i + 1} of ${images.length}`}
                />
              ))}
            </ScrollView>

            {images.length > 1 && (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === imageIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>📦</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.body}>
          {/* Source + condition row */}
          <View style={styles.metaRow}>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
            </View>
            {product.condition ? (
              <View style={styles.conditionBadge}>
                <Text style={styles.conditionText}>{product.condition}</Text>
              </View>
            ) : null}
          </View>

          {/* Title */}
          <Text style={styles.title}>{product.name}</Text>

          {/* Price */}
          <Text style={styles.price}>
            {product.price != null ? `$${product.price.toFixed(2)} ${currency}` : 'Price TBC'}
          </Text>

          {/* AI summary */}
          {product.aiSummary ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Taylin says</Text>
              <Text style={styles.summaryText}>{product.aiSummary}</Text>
            </View>
          ) : null}

          {/* Seller info (eBay / Trade Me) */}
          {product.seller ? (
            <View style={styles.sellerRow}>
              <Text style={styles.sellerLabel}>Seller</Text>
              <Text style={styles.sellerName}>{product.seller.name}</Text>
              {product.seller.rating > 0 && (
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>{product.seller.rating.toFixed(0)}% positive</Text>
                </View>
              )}
            </View>
          ) : !isExternal ? (
            <View style={styles.escrowRow}>
              <EscrowBadge tier={tier} />
            </View>
          ) : null}

          {/* Description */}
          {product.description ? (
            <Text style={styles.description}>{product.description}</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaBar}>
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
          onPress={handleBuy}
          accessibilityLabel={isExternal ? `Buy on ${sourceLabel}` : `Confirm purchase for $${product.price?.toFixed(2)}`}
          accessibilityRole="button"
        >
          <Text style={styles.ctaBtnText}>
            {isExternal ? `Buy on ${sourceLabel} →` : `Pay $${product.price?.toFixed(2) ?? 'TBC'}`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    backRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
    backBtn: { color: c.accent, fontSize: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorText: { color: c.error, fontSize: 15 },
    content: { paddingBottom: 100 },

    // Gallery
    galleryContainer: { backgroundColor: c.surface },
    gallery: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
    galleryImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
    imagePlaceholder: {
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH * 0.6,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePlaceholderText: { fontSize: 64 },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.border,
    },
    dotActive: { backgroundColor: c.accent },

    // Body
    body: { padding: 20, gap: 14 },
    metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    sourceBadge: {
      backgroundColor: c.chipBg,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    sourceBadgeText: { fontSize: 11, fontWeight: '600', color: c.textMuted },
    conditionBadge: {
      backgroundColor: c.success + '20',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    conditionText: { fontSize: 11, fontWeight: '600', color: c.success },
    title: { fontSize: 20, fontWeight: '700', color: c.text, lineHeight: 28 },
    price: { fontSize: 32, fontWeight: '800', color: c.primary, letterSpacing: -1 },

    summaryCard: {
      backgroundColor: c.accent + '12',
      borderRadius: 14,
      padding: 14,
      borderLeftWidth: 3,
      borderLeftColor: c.accent,
    },
    summaryLabel: { fontSize: 10, fontWeight: '700', color: c.accent, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
    summaryText: { fontSize: 14, color: c.text, lineHeight: 20 },

    sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    sellerLabel: { fontSize: 12, color: c.textMuted },
    sellerName: { fontSize: 14, fontWeight: '600', color: c.text },
    ratingBadge: {
      backgroundColor: c.success + '20',
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    ratingText: { fontSize: 11, color: c.success, fontWeight: '600' },
    escrowRow: { alignItems: 'flex-start' },
    description: { fontSize: 14, color: c.textSecondary, lineHeight: 21 },

    // CTA
    ctaBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      paddingBottom: 28,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
      ...cardShadow,
    },
    ctaBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaBtnText: { color: c.textOnPrimary, fontSize: 18, fontWeight: '700' },
  })
}
