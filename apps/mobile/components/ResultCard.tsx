import React from 'react'
import { View, Text, Pressable, Image, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { EscrowBadge } from './EscrowBadge'

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
      ? `Delivery ${product.delivery_days_min}–${product.delivery_days_max} days`
      : 'Delivery TBC'

  const accessLabel = [
    `Result ${rank}:`,
    product.name,
    `$${product.price.toFixed(2)} ${currency}.`,
    deliveryText + '.',
    product.aiSummary ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Pressable
      style={styles.card}
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

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        {product.aiSummary ? (
          <Text style={styles.summary} numberOfLines={2}>
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
    </Pressable>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      minHeight: 100,
    },
    image: { width: 100, height: 100 },
    imagePlaceholder: {
      backgroundColor: c.backgroundAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePlaceholderText: { fontSize: 32 },
    body: { flex: 1, padding: 12, justifyContent: 'space-between' },
    name: { fontSize: 15, fontWeight: '600', color: c.text, lineHeight: 20 },
    summary: { fontSize: 13, color: c.textSecondary, marginTop: 4, lineHeight: 18 },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 8,
    },
    price: { fontSize: 18, fontWeight: '800', color: c.primary },
    delivery: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  })
}
