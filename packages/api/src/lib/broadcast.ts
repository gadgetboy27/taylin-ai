/**
 * Geo-expanding deal broadcast. Strawman algorithm — thresholds and tier
 * definitions here are a starting point, meant to be tuned once real usage
 * data exists, not a finished formula.
 *
 * Only postcode/city exist on users/sellers today (migration 014_geo.sql —
 * no lat/lng, no region field). 'city' and 'region' therefore collapse to
 * the same city-match query, and 'national'/'international' both collapse
 * to "everyone with an address on file" (this app is NZ-only today, so
 * there's no country field to distinguish them yet). The 5-tier enum on
 * `deals.broadcast_radius_tier` is kept as-is so the schema doesn't need to
 * change when finer-grained location data is added later.
 */
import { supabase } from './supabase.js'
import { sendNotificationBatch } from './push.js'

const RADIUS_TIERS = ['local', 'city', 'region', 'national', 'international'] as const
export type RadiusTier = typeof RADIUS_TIERS[number]

const MAX_NOTIFIED_PER_DEAL = 5000

async function findBuyersInTier(
  sellerPostcode: string | null,
  sellerCity: string | null,
  tier: RadiusTier
): Promise<string[]> {
  if (tier === 'national' || tier === 'international') {
    const { data } = await supabase.from('users').select('id').not('postcode', 'is', null)
    return (data ?? []).map((u) => u.id)
  }

  if (tier === 'city' || tier === 'region') {
    if (!sellerCity) return []
    const { data } = await supabase.from('users').select('id').eq('city', sellerCity)
    return (data ?? []).map((u) => u.id)
  }

  if (!sellerPostcode) return []
  const { data } = await supabase.from('users').select('id').eq('postcode', sellerPostcode)
  return (data ?? []).map((u) => u.id)
}

type DealForNotify = {
  id: string
  title: string
  price: number
  currency: string
  status: string
  broadcast_radius_tier: string
  notified_count: number
  notified_user_ids: string[]
  sellers: { postcode: string | null; city: string | null } | null
}

// Notifies buyers newly reachable at the deal's CURRENT tier (never sends a
// repeat to someone in notified_user_ids). Called once on deal creation
// (local tier), and again on every cron tick in case new buyers joined the
// current tier since the last run.
export async function notifyForDeal(dealId: string): Promise<{ tier: RadiusTier; newlyNotified: number }> {
  const { data: deal } = await supabase
    .from('deals')
    .select('id, title, price, currency, status, broadcast_radius_tier, notified_count, notified_user_ids, sellers(postcode, city)')
    .eq('id', dealId)
    .single<DealForNotify>()

  const tier = (deal?.broadcast_radius_tier ?? 'local') as RadiusTier
  if (!deal || deal.status !== 'active') return { tier, newlyNotified: 0 }
  if (deal.notified_count >= MAX_NOTIFIED_PER_DEAL) return { tier, newlyNotified: 0 }

  const candidateIds = await findBuyersInTier(deal.sellers?.postcode ?? null, deal.sellers?.city ?? null, tier)
  const alreadyNotified = new Set(deal.notified_user_ids)
  const newIds = candidateIds
    .filter((id) => !alreadyNotified.has(id))
    .slice(0, MAX_NOTIFIED_PER_DEAL - deal.notified_count)

  if (newIds.length === 0) return { tier, newlyNotified: 0 }

  await sendNotificationBatch(newIds, {
    title: 'New local deal',
    body: `${deal.title} — ${deal.currency} ${deal.price}`,
    data: { dealId: deal.id },
  })

  await supabase
    .from('deals')
    .update({
      notified_user_ids: [...alreadyNotified, ...newIds],
      notified_count: deal.notified_count + newIds.length,
    })
    .eq('id', dealId)

  return { tier, newlyNotified: newIds.length }
}

// Strawman thresholds: expand reach once a deal is at least a third of the
// way through its time window AND still has more than half its stock —
// i.e. it isn't selling out fast enough locally to justify staying local.
export function shouldExpandTier(deal: {
  quantity_remaining: number
  quantity_original: number
  expires_at: string
  created_at: string
}): boolean {
  const totalWindowMs = new Date(deal.expires_at).getTime() - new Date(deal.created_at).getTime()
  if (totalWindowMs <= 0) return false

  const timeFractionElapsed = (Date.now() - new Date(deal.created_at).getTime()) / totalWindowMs
  const quantityFractionRemaining = deal.quantity_remaining / deal.quantity_original

  return quantityFractionRemaining > 0.5 && timeFractionElapsed > 0.33
}

export function nextTier(tier: RadiusTier): RadiusTier | null {
  const idx = RADIUS_TIERS.indexOf(tier)
  if (idx === -1 || idx === RADIUS_TIERS.length - 1) return null
  return RADIUS_TIERS[idx + 1]
}
