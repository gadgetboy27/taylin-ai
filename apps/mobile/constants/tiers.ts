export type SellerTier = 1 | 2 | 3

export type TierConfig = {
  label: string
  description: string
  feePercent: number
  escrowRequired: boolean
  autoReleaseHours: number | null
  buyerConfirmRequired: boolean
  idVerificationRequired: boolean
  badgeColor: string
}

export const TIER_CONFIG: Record<SellerTier, TierConfig> = {
  1: {
    label: 'Verified retailer',
    description: 'GST registered NZ business with verified catalogue',
    feePercent: 10,
    escrowRequired: false,
    autoReleaseHours: null,
    buyerConfirmRequired: false,
    idVerificationRequired: false,
    badgeColor: '#10B981',
  },
  2: {
    label: 'Marketplace seller',
    description: 'Semi-verified trader or small business',
    feePercent: 13,
    escrowRequired: true,
    autoReleaseHours: 48,
    buyerConfirmRequired: false,
    idVerificationRequired: false,
    badgeColor: '#F59E0B',
  },
  3: {
    label: 'Individual / P2P',
    description: 'Unverified individual seller',
    feePercent: 15,
    escrowRequired: true,
    autoReleaseHours: 168,
    buyerConfirmRequired: true,
    idVerificationRequired: true,
    badgeColor: '#EF4444',
  },
}
