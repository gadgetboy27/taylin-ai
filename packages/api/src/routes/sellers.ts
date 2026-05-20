import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { supabase } from '../lib/supabase.js'
import { assignTier } from '../lib/tiers.js'
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

// ── Interview: start a new application ───────────────────────────────────────
sellersRoute.post('/apply/start', async (c) => {
  const userId = c.get('userId')

  // Check if they already have an in-progress application
  const { data: existing } = await supabase
    .from('seller_applications')
    .select('id, status, conversation')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .single()

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

      // Create the seller record
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
        })
        .select('id, trust_tier')
        .single()

      if (sellerError) return c.json({ error: 'Failed to create seller profile' }, 500)

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
