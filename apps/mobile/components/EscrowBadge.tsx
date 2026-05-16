import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { TIER_CONFIG, type SellerTier } from '@/constants/tiers'

interface EscrowBadgeProps {
  tier: SellerTier
  compact?: boolean
}

export function EscrowBadge({ tier, compact = false }: EscrowBadgeProps) {
  const config = TIER_CONFIG[tier]

  if (compact) {
    return (
      <View
        style={[styles.dot, { backgroundColor: config.badgeColor + '30' }]}
        accessible={true}
        accessibilityLabel={`Seller trust: ${config.label}`}
      >
        <View style={[styles.dotInner, { backgroundColor: config.badgeColor }]} />
      </View>
    )
  }

  return (
    <View
      style={[styles.badge, { backgroundColor: config.badgeColor + '20', borderColor: config.badgeColor + '40' }]}
      accessible={true}
      accessibilityLabel={`${config.label}. ${config.escrowRequired ? 'Escrow protected.' : 'Direct purchase.'}`}
    >
      <View style={[styles.indicator, { backgroundColor: config.badgeColor }]} />
      <Text style={[styles.label, { color: config.badgeColor }]}>
        {config.label}
      </Text>
      {config.escrowRequired && (
        <Text style={[styles.escrowTag, { color: config.badgeColor }]}>
          · Escrow
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'flex-start',
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  escrowTag: {
    fontSize: 12,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
