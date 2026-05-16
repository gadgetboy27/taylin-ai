export const PLATFORM_FEES = {
  tier1Percent: 10,
  tier2Percent: 13,
  tier3Percent: 15,
  minimumFeeNZD: 0.5,
  escrowHoldDaysP2P: 7,
  escrowHoldDaysMarketplace: 2,
  maxTransactionNZD: 5000,
} as const

export const SPEND_LIMITS = {
  defaultPerTransactionNZD: 200,
  defaultMonthlyNZD: 2000,
  maxPerTransactionNZD: 5000,
  maxMonthlyNZD: 20000,
} as const
