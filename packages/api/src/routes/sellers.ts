import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'
import { assignTier } from '../lib/tiers.js'
import { authMiddleware } from '../middleware/auth.js'
import { importCatalogue } from '../lib/catalogue-import.js'
import {
  conductInterview,
  scoreInterview,
  type InterviewMessage,
  type VerificationResult,
} from '../lib/seller-interview.js'

export const sellersRoute = new Hono()

// ── Public: list verified sellers ────────────────────────────────────────────
sellersRoute.get('/', async (c) => {
  const { data } = await supabase
    .from('sellers')
    .select('id, business_name, trust_tier, gst_registered, identity_verified, total_orders')
    .order('trust_tier')
    .limit(50)

  return c.json({ sellers: data ?? [] })
})

// ── Auth: dashboard bootstrap for the logged-in seller (requires auth) ───────
sellersRoute.get('/me', async (c) => {
  const userId = c.get('userId')

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, business_name, trust_tier, gst_registered, identity_verified, total_orders, onboarded_at')
    .eq('owner_user_id', userId)
    .single()

  if (!seller) return c.json({ error: 'No seller profile for this account' }, 404)
  return c.json({ seller })
})

// ── Seller: import (or re-import) a catalogue from their website URL ────────
sellersRoute.post(
  '/me/catalogue/import',
  authMiddleware,
  zValidator('json', z.object({ url: z.string().min(3).optional() })),
  async (c) => {
    const userId = c.get('userId')
    const { url } = c.req.valid('json')

    const { data: seller } = await supabase
      .from('sellers')
      .select('id, status, catalogue_url')
      .eq('owner_user_id', userId)
      .single()

    if (!seller) return c.json({ error: 'No seller profile for this account' }, 404)
    if (seller.status !== 'active') return c.json({ error: 'Seller account is not active' }, 403)

    const targetUrl = url ?? seller.catalogue_url
    if (!targetUrl) return c.json({ error: 'No catalogue URL provided or on file' }, 400)

    if (url && url !== seller.catalogue_url) {
      await supabase.from('sellers').update({ catalogue_url: url }).eq('id', seller.id)
    }

    const result = await importCatalogue(seller.id, targetUrl)
    return c.json(result)
  }
)

// ── Cron: re-sync catalogues that haven't been checked in 24h ────────────────
// Same X-Cron-Secret pattern as signals.ts /run and escrow.ts /auto-release.
sellersRoute.post('/catalogue/resync', async (c) => {
  const cronSecret = c.req.header('X-Cron-Secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: sellersToSync } = await supabase
    .from('sellers')
    .select('id, catalogue_url')
    .eq('status', 'active')
    .not('catalogue_url', 'is', null)
    .or(`catalogue_last_synced.is.null,catalogue_last_synced.lt.${staleThreshold}`)

  let synced = 0
  let productsInserted = 0

  for (const seller of sellersToSync ?? []) {
    if (!seller.catalogue_url) continue
    const result = await importCatalogue(seller.id, seller.catalogue_url)
    synced++
    productsInserted += result.productsInserted
  }

  return c.json({ processed: (sellersToSync ?? []).length, synced, productsInserted })
})

// ── Interview: start a new application ───────────────────────────────────────
sellersRoute.post('/apply/start', async (c) => {
  const userId = c.get('userId')

  // Check if they already have an in-progress application.
  // maybeSingle + limit(1) rather than single(): single() errors when more than
  // one row matches, which would null `existing` and silently start a *third*
  // application, orphaning the conversation this resume exists to protect.
  // Newest wins if duplicates ever appear.
  const { data: existing } = await supabase
    .from('seller_applications')
    .select('id, status, conversation')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const conv = existing.conversation as InterviewMessage[]
    return c.json({
      applicationId: existing.id,
      message: conv.at(-1)?.role === 'taylor'
        ? conv.at(-1)!.content
        : "Welcome back! Where were we?",
      conversation: conv,
      resuming: true,
    })
  }

  // Start fresh interview — get Taylor's opening message
  const { response, verification } = await conductInterview([], {})

  const firstMessage: InterviewMessage = {
    role: 'taylor',
    content: response.message,
    ts: new Date().toISOString(),
    verificationResult: verification ?? undefined,
  }

  const { data: app, error } = await supabase
    .from('seller_applications')
    .insert({
      user_id: userId,
      conversation: [firstMessage],
      extracted_data: response.extractedData ?? {},
      verification_results: {},
    })
    .select('id')
    .single()

  if (error) return c.json({ error: 'Failed to start application' }, 500)

  return c.json({
    applicationId: app.id,
    message: response.message,
    conversation: [firstMessage],
    resuming: false,
  })
})

// ── Interview: send a message, get Taylor's reply ────────────────────────────
sellersRoute.post(
  '/apply/message',
  zValidator('json', z.object({
    applicationId: z.string().uuid(),
    message: z.string().min(1).max(2000),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { applicationId, message } = c.req.valid('json')

    const { data: app } = await supabase
      .from('seller_applications')
      .select('id, conversation, extracted_data, verification_results, status')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .single()

    if (!app) return c.json({ error: 'Application not found' }, 404)
    if (app.status !== 'in_progress') return c.json({ error: 'Interview already complete' }, 409)

    const history = app.conversation as InterviewMessage[]
    const existingVerifications = app.verification_results as Record<string, VerificationResult>
    const existingExtracted = app.extracted_data as Record<string, unknown>

    // Append the seller's message
    const sellerMessage: InterviewMessage = {
      role: 'seller',
      content: message,
      ts: new Date().toISOString(),
    }
    const updatedHistory = [...history, sellerMessage]

    // Get Taylor's response (may include a background verification)
    const { response, verification } = await conductInterview(updatedHistory, existingVerifications)

    const taylorMessage: InterviewMessage = {
      role: 'taylor',
      content: response.message,
      ts: new Date().toISOString(),
      verificationResult: verification ?? undefined,
    }

    const finalHistory = [...updatedHistory, taylorMessage]

    // Merge extracted data — new values overwrite nulls, never overwrite real values with null
    const mergedExtracted = { ...existingExtracted }
    for (const [key, value] of Object.entries(response.extractedData ?? {})) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value) && value.length === 0) continue
        mergedExtracted[key] = value
      }
    }

    // Merge verifications
    const mergedVerifications = { ...existingVerifications }
    if (verification) {
      const key = `${verification.type}_${Date.now()}`
      mergedVerifications[key] = verification
    }

    // Handle completion
    if (response.complete) {
      const scores = await scoreInterview(
        mergedExtracted as Parameters<typeof scoreInterview>[0],
        mergedVerifications,
        finalHistory
      )

      // Create the seller record — owner_user_id links it back to the buyer
      // identity that completed this interview, so they can log in as this
      // seller via the existing SMS-OTP auth flow (no separate seller login).
      const { data: seller, error: sellerError } = await supabase
        .from('sellers')
        .insert({
          business_name: (mergedExtracted.businessName as string) ?? 'Unknown Business',
          contact_email: '',   // filled from user profile on the frontend
          gst_registered: (mergedExtracted.gstRegistered as boolean) ?? false,
          identity_verified: scores.trustTier <= 2,
          website_url: (mergedExtracted.website as string) ?? null,
          nzbn: (mergedExtracted.nzbn as string) ?? null,
          online_verified: Object.values(mergedVerifications).some((v) => v.success),
          trust_tier: scores.trustTier,
          truth_layer: mergedExtracted,
          verification_summary: mergedVerifications,
          onboarded_at: new Date().toISOString(),
          owner_user_id: userId,
          postcode: (mergedExtracted.postcode as string) ?? null,
          city: (mergedExtracted.locationNZ as string) ?? null,
        })
        .select('id, trust_tier')
        .single()

      if (sellerError) return c.json({ error: 'Failed to create seller profile' }, 500)

      // Upgrade the buyer identity to 'both' — they keep buying, and can now
      // also reach the seller dashboard as the same logged-in user.
      await supabase.from('users').update({ role: 'both' }).eq('id', userId)

      await supabase
        .from('seller_applications')
        .update({
          status: 'complete',
          conversation: finalHistory,
          extracted_data: mergedExtracted,
          verification_results: mergedVerifications,
          specificity_score: scores.specificityScore,
          consistency_score: scores.consistencyScore,
          verification_score: scores.verificationScore,
          trust_tier: scores.trustTier,
          seller_id: seller.id,
          completed_at: new Date().toISOString(),
        })
        .eq('id', applicationId)

      return c.json({
        message: response.message,
        complete: true,
        tier: scores.trustTier,
        summary: scores.summary,
        sellerId: seller.id,
        conversation: finalHistory,
      })
    }

    // Normal turn — save state and return
    await supabase
      .from('seller_applications')
      .update({
        conversation: finalHistory,
        extracted_data: mergedExtracted,
        verification_results: mergedVerifications,
      })
      .eq('id', applicationId)

    return c.json({
      message: response.message,
      complete: false,
      verification: verification ?? null,
      conversation: finalHistory,
    })
  }
)

// ── Get application state (for resuming) ─────────────────────────────────────
sellersRoute.get('/apply/:id', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  const { data } = await supabase
    .from('seller_applications')
    .select('id, status, conversation, trust_tier, completed_at')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// ── Admin: manual seller creation (kept for internal use) ────────────────────
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
