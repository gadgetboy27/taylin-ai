import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'
import { assignTier } from '../lib/tiers.js'

export const sellersRoute = new Hono()

// Public — list verified sellers
sellersRoute.get('/', async (c) => {
  const { data } = await supabase
    .from('sellers')
    .select('id, business_name, trust_tier, gst_registered, identity_verified, total_orders')
    .order('trust_tier')
    .limit(50)

  return c.json({ sellers: data ?? [] })
})

// Admin only — onboard a new seller
sellersRoute.post(
  '/',
  zValidator(
    'json',
    z.object({
      businessName: z.string().min(2).max(200),
      contactEmail: z.string().email(),
      gstRegistered: z.boolean().default(false),
      identityVerified: z.boolean().default(false),
      catalogueUrl: z.string().url().optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid('json')

    const tier = assignTier({
      gstRegistered: body.gstRegistered,
      identityVerified: body.identityVerified,
      hasApiCatalogue: !!body.catalogueUrl,
      disputeRate: 0,
      totalOrders: 0,
    })

    const { data, error } = await supabase
      .from('sellers')
      .insert({
        business_name: body.businessName,
        contact_email: body.contactEmail,
        gst_registered: body.gstRegistered,
        identity_verified: body.identityVerified,
        catalogue_url: body.catalogueUrl,
        trust_tier: tier,
      })
      .select('id, trust_tier')
      .single()

    if (error) return c.json({ error: 'Failed to create seller' }, 500)
    return c.json({ sellerId: data.id, tier: data.trust_tier }, 201)
  }
)
