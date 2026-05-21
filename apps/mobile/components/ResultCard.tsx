import React from 'react'
import { View, Text, Pressable, Image, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { EscrowBadge } from './EscrowBadge'
import { cardShadow } from '@/lib/styles'
import { storeProduct } from '@/lib/product-store'

export type Product = {
  id: string
  name: string
  description?: string
  price?: number
  currency?: string
  images?: string[]
  seller_id?: string
  seller?: { name: string; rating: number }
  condition?: string
  url?: string
  source?: 'ebay' | 'trademe' | 'web' | 'amadeus' | 'aliexpress'
  delivery_days_min?: number
  delivery_days_max?: number
  aiSummary?: string
  sellerTier?: 1 | 2 | 3
  searchId: string
}

const SOURCE_LABEL: Record<string, string> = {
  ebay: 'eBay',
  trademe: 'Trade Me',
  web: 'Web',
  amadeus: 'Flights',
  aliexpress: 'AliExpress',
}

interface ResultCardProps {
  product: Product
  rank: number
}

export function ResultCard({ product, rank }: ResultCardProps) {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const currency = product.currency ?? 'NZD'
  const tier = product.sellerTier ?? 2
  const image = product.images?.[0]
  const isExternal = !!product.source
  const sourceLabel = product.source ? SOURCE_LABEL[product.source] ?? product.source : null
  const deliveryText =
    product.delivery_days_min != null
      ? `${product.delivery_days_min}–${product.delivery_days_max} day delivery`
      : isExternal ? 'View listing for delivery info' : 'Delivery TBC'

  const isTopPick = rank === 1

  const accessLabel = [
    isTopPick ? 'Top pick:' : `Result ${rank}:`,
    sourceLabel ? `via ${sourceLabel}.` : null,
    product.name,
    product.price != null ? `$${product.price.toFixed(2)} ${currency}.` : 'Price on request.',
    deliveryText + '.',
    product.aiSummary ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const handlePress = () => {
    storeProduct(product)
    router.push({ pathname: '/result/detail', params: { id: product.id } })
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isTopPick && styles.cardTopPick,
        pressed && styles.cardPressed,
      ]}
      onPress={handlePress}
      accessibilityLabel={accessLabel}
      accessibilityHint="Tap to view product details"
      accessibilityRole="button"
    >
      {/* Top pick label */}
      {isTopPick && (
        <View style={styles.topPickBanner}>
          <Text style={styles.topPickText}>Agent's pick</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        {/* Image */}
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.image}
            accessibilityLabel={`Product image for ${product.name}`}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>📦</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>

          {product.aiSummary ? (
            <Text style={styles.summary} numberOfLines={3}>
              {product.aiSummary}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <View>
              <Text style={styles.price}>
                {product.price != null ? `$${product.price.toFixed(2)}` : 'Price TBC'}
              </Text>
              <Text style={styles.delivery}>{deliveryText}</Text>
            </View>
            {isExternal && sourceLabel ? (
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
              </View>
            ) : (
              <EscrowBadge tier={tier} compact />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.glassBackground,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.glassBorder,
      overflow: 'hidden',
      ...cardShadow,
    },
    cardTopPick: {
      borderColor: c.accent + '80',
      borderWidth: 1.5,
    },
    cardPressed: {
      opacity: 0.85,
    },

    // "Agent's pick" banner across top of card 1
    topPickBanner: {
      backgroundColor: c.accent + '18',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: c.accent + '30',
    },
    topPickText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },

    cardBody: {
      flexDirection: 'row',
      minHeight: 110,
    },
    image: {
      width: 110,
      height: 110,
    },
    imagePlaceholder: {
      backgroundColor: c.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePlaceholderText: {
      fontSize: 34,
    },
    content: {
      flex: 1,
      padding: 14,
      justifyContent: 'space-between',
    },
    name: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
      lineHeight: 21,
    },
    summary: {
      fontSize: 13,
      color: c.textSecondary,
      marginTop: 5,
      lineHeight: 18,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 10,
    },
    price: {
      fontSize: 20,
      fontWeight: '800',
      color: c.primary,
      letterSpacing: -0.5,
    },
    delivery: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
    },
    sourceBadge: {
      backgroundColor: c.chipBg,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    sourceBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: c.textMuted,
    },
  })
}
