import React from 'react'
import { View, Text, Pressable, Image, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { EscrowBadge } from './EscrowBadge'
import { cardShadow } from '@/lib/styles'

export type Product = {
  id: string
  name: string
  description?: string
  price: number
  currency?: string
  images?: string[]
  seller_id: string
  delivery_days_min?: number
  delivery_days_max?: number
  aiSummary?: string
  sellerTier?: 1 | 2 | 3
  searchId: string
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
  const deliveryText =
    product.delivery_days_min != null
      ? `${product.delivery_days_min}–${product.delivery_days_max} day delivery`
      : 'Delivery TBC'

  const isTopPick = rank === 1

  const accessLabel = [
    isTopPick ? 'Top pick:' : `Result ${rank}:`,
    product.name,
    `$${product.price.toFixed(2)} ${currency}.`,
    deliveryText + '.',
    product.aiSummary ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isTopPick && styles.cardTopPick,
        pressed && styles.cardPressed,
      ]}
      onPress={() =>
        router.push({
          pathname: '/result/approve',
          params: {
            searchId: product.searchId,
            productId: product.id,
            amount: String(product.price),
            sellerTier: String(tier),
            productName: product.name,
          },
        })
      }
      accessibilityLabel={accessLabel}
      accessibilityHint="Tap to review and approve this purchase"
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
              <Text style={styles.price}>${product.price.toFixed(2)}</Text>
              <Text style={styles.delivery}>{deliveryText}</Text>
            </View>
            <EscrowBadge tier={tier} compact />
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
  })
}
