import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import {
  createConnectAccount,
  createOnboardingLink,
  getConnectStatus,
} from '../lib/stripe.js'
import { assignTier } from '../lib/tiers.js'

export const connectRoute = new Hono()

async function loadSeller(userId: string) {
  const { data } = await supabase
    .from('sellers')
    .select('id, business_name, contact_email, stripe_connect_account_id, gst_registered, dispute_rate, total_orders, catalogue_url')
    .eq('owner_user_id', userId)
    .maybeSingle()
  return data
}

// POST /connect/onboard — start (or resume) Stripe Connect onboarding.
// Returns a URL the seller opens to complete Stripe's identity checks.
connectRoute.post('/onboard', async (c) => {
  const userId = c.get('userId')
  const seller = await loadSeller(userId)
  if (!seller) return c.json({ error: 'No seller profile — complete the interview first' }, 404)

  try {
    let accountId = seller.stripe_connect_account_id
    if (!accountId) {
      accountId = await createConnectAccount({
        email: seller.contact_email,
        businessName: seller.business_name,
      })
      await supabase
        .from('sellers')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', seller.id)
    }

    const appUrl = process.env.APP_URL ?? 'http://localhost:8081'
    const url = await createOnboardingLink({
      accountId,
      refreshUrl: `${appUrl}/seller/dashboard`,
      returnUrl: `${appUrl}/seller/dashboard`,
    })

    return c.json({ url })
  } catch (err) {
    console.error('[connect] onboarding failed:', err)
    return c.json({ error: 'Could not start Stripe onboarding' }, 502)
  }
})

// POST /connect/sync — re-read Stripe and update identity_verified + tier.
//
// Deliberately explicit rather than trusting a cached flag: identity_verified
// now drives fees and search visibility, so it should reflect what Stripe says
// right now. Call it when the seller returns from onboarding, and from the
// account.updated webhook once that's wired.
connectRoute.post('/sync', async (c) => {
  const userId = c.get('userId')
  const seller = await loadSeller(userId)
  if (!seller) return c.json({ error: 'No seller profile' }, 404)
  if (!seller.stripe_connect_account_id) {
    return c.json({ error: 'Stripe onboarding not started' }, 400)
  }

  try {
    const status = await getConnectStatus(seller.stripe_connect_account_id)

    // Recompute the tier from the verified identity rather than leaving it at
    // whatever the interview guessed.
    const tier = assignTier({
      gstRegistered: seller.gst_registered,
      identityVerified: status.identityVerified,
      hasApiCatalogue: !!seller.catalogue_url,
      disputeRate: Number(seller.dispute_rate ?? 0),
      totalOrders: seller.total_orders ?? 0,
    })

    await supabase
      .from('sellers')
      .update({
        identity_verified: status.identityVerified,
        identity_source: status.identityVerified ? 'stripe_connect' : null,
        identity_verified_at: status.identityVerified ? new Date().toISOString() : null,
        trust_tier: tier,
      })
      .eq('id', seller.id)

    return c.json({
      identityVerified: status.identityVerified,
      payoutsEnabled: status.payoutsEnabled,
      outstanding: status.outstanding,
      trustTier: tier,
    })
  } catch (err) {
    console.error('[connect] sync failed:', err)
    return c.json({ error: 'Could not read Stripe account status' }, 502)
  }
})
