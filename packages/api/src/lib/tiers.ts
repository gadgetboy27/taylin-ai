export type SellerTier = 1 | 2 | 3

export type TierConfig = {
  label: string
  feePercent: number
  escrowRequired: boolean
  autoReleaseHours: number | null
  buyerConfirmRequired: boolean
}

export const TIER_CONFIG: Record<SellerTier, TierConfig> = {
  1: {
    label: 'Verified retailer',
    feePercent: 10,
    escrowRequired: false,
    autoReleaseHours: null,
    buyerConfirmRequired: false,
  },
  2: {
    label: 'Marketplace seller',
    feePercent: 13,
    escrowRequired: true,
    autoReleaseHours: 48,
    buyerConfirmRequired: false,
  },
  3: {
    label: 'Individual / P2P',
    feePercent: 15,
    escrowRequired: true,
    autoReleaseHours: 168,
    buyerConfirmRequired: true,
  },
}

export function assignTier(seller: {
  gstRegistered: boolean
  identityVerified: boolean
  hasApiCatalogue: boolean
  disputeRate: number
  totalOrders: number
}): SellerTier {
  if (
    seller.gstRegistered &&
    seller.hasApiCatalogue &&
    seller.disputeRate < 0.02 &&
    seller.totalOrders > 10
  )
    return 1
  if (seller.identityVerified && seller.disputeRate < 0.05) return 2
  return 3
}
