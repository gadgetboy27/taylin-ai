/**
 * Taylor — the AI seller interview conductor.
 *
 * Manages a natural conversation that extracts structured truth-layer data,
 * triggers online verifications, and assigns a trust tier on completion.
 *
 * Design: each turn the full conversation history is passed to Claude.
 * Claude responds with a JSON envelope (hidden from the seller) that contains
 * the natural-language reply plus any extraction/verification directives.
 */

import Anthropic from '@anthropic-ai/sdk'
import { parseJsonFromText } from './parse-json.js'
import { lookupNZBN, nzbnSummary, type NzbnResult } from './nzbn.js'
import { verifyUrl, searchBusiness, type UrlVerifyResult, type SearchResult } from './web-verify.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Types ────────────────────────────────────────────────────────────────────

export type InterviewMessage = {
  role: 'taylor' | 'seller'
  content: string
  ts: string
  verificationResult?: VerificationResult
}

export type VerificationResult = {
  type: 'nzbn' | 'url' | 'search'
  success: boolean
  label: string          // e.g. "Hereford Coffee Ltd — Active · GST registered"
  data?: unknown
}

export type ExtractedData = {
  sellerName: string | null
  businessName: string | null
  nzbn: string | null
  gstRegistered: boolean | null
  website: string | null
  socialUrls: string[]
  categories: string[]
  priceRange: string | null
  differentiation: string | null       // the truth layer gold
  sourcingDetails: string | null
  returnsPolicy: string | null
  expectedOrdersPerWeek: number | null
  locationNZ: string | null
  postcode: string | null
}

export type TaylorResponse = {
  message: string
  stage: InterviewStage
  triggerVerification: TriggerVerification | null
  extractedData: Partial<ExtractedData>
  complete: boolean
  redFlags: string[]
}

type TriggerVerification =
  | { type: 'nzbn'; value: string }
  | { type: 'url'; value: string }
  | { type: 'search'; query: string }

type InterviewStage =
  | 'welcome'
  | 'products'
  | 'legitimacy'
  | 'online_presence'
  | 'differentiation'
  | 'trust_policies'
  | 'complete'

export type InterviewScore = {
  specificityScore: number     // 0–10
  consistencyScore: number     // 0–10
  verificationScore: number    // 0–10
  trustTier: 1 | 2 | 3
  summary: string
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Taylor, the friendly seller onboarding assistant for taylin.ai — a New Zealand AI-powered buyer's agent. Sellers come to you to get listed on the platform.

YOUR JOB:
1. Learn about the seller's business through natural conversation — enough detail for our AI to recommend them accurately to buyers.
2. Gather verification signals (NZBN, website, social media) without making it feel like an interrogation.
3. Build their "truth layer" — specific, factual data about what they sell and what makes them different.
4. Detect inconsistencies or vague answers that might signal low quality listings.

PERSONA: Warm, curious, professional. Like a smart NZ colleague doing due diligence over coffee. Use casual NZ English — "brilliant", "sweet as", "cheers", "keen". Keep messages SHORT — max 2-3 sentences. Ask ONE question at a time. Never use bullet points or numbered lists in your messages.

INTERVIEW STAGES (work through these in order, but naturally):
1. welcome — Introduce yourself briefly, ask their first name and business/shop name.
2. products — What they sell. Push for specifics — "what kind of coffee?", "handmade how?". Generic answers need follow-ups.
3. legitimacy — NZBN or GST status, and their postcode (so we can show them to nearby buyers first). Frame it positively. If they give you digits that look like an NZBN (13 digits), extract it.
4. online_presence — Website, Facebook, Instagram, TradeMe profile. Ask permission before searching.
5. differentiation — What makes them genuinely stand out. This is the most important stage — push for real specifics, not marketing fluff.
6. trust_policies — Returns/refunds approach and rough order volume.
7. complete — Warm summary of what you learned, tell them their initial tier and what it means, welcome them.

RESPONSE FORMAT:
You must ALWAYS respond with valid JSON only — no markdown, no preamble. Structure:
{
  "message": "Your natural language message to the seller",
  "stage": "current_stage_name",
  "triggerVerification": null,
  "extractedData": {
    "sellerName": null,
    "businessName": null,
    "nzbn": null,
    "gstRegistered": null,
    "website": null,
    "socialUrls": [],
    "categories": [],
    "priceRange": null,
    "differentiation": null,
    "sourcingDetails": null,
    "returnsPolicy": null,
    "expectedOrdersPerWeek": null,
    "locationNZ": null,
    "postcode": null
  },
  "complete": false,
  "redFlags": []
}

triggerVerification can be:
- null (no verification needed this turn)
- { "type": "nzbn", "value": "1234567890123" } — when you have a 13-digit NZBN
- { "type": "url", "value": "https://example.co.nz" } — when seller gives you a URL and consents
- { "type": "search", "query": "Hereford Coffee Hamilton NZ" } — for general business search

Set "complete": true only in the "complete" stage after you've covered all areas.

extractedData: include ALL fields every turn, even if null. Update fields as new info comes in.

redFlags: note things like: vague product descriptions, NZBN that doesn't match business name, website that describes something different to what they said, extremely low prices suggesting counterfeit.`

// ── Main conductor function ───────────────────────────────────────────────────

/**
 * The stage list says "work through these in order, but naturally" and tells
 * Taylor to push for specifics — with no budget, so it will happily keep
 * probing forever. Interviews were running past 30 messages still asking
 * questions, which is both a bad experience and progressively slower, since the
 * whole transcript is re-sent every turn.
 *
 * The advertised length is "about 5 minutes", so this holds it near that.
 */
function pacingDirective(history: InterviewMessage[]): string {
  const answers = history.filter((m) => m.role === 'seller').length

  if (answers >= 10) {
    return `\n\nPACING: The seller has answered ${answers} questions — well past the 5 minutes this was sold as. Move to the "complete" stage in THIS reply: summarise what you have, give them their tier, and set "complete": true. Ask nothing further, and do not apologise for the length.`
  }
  if (answers >= 6) {
    return `\n\nPACING: ${answers} questions answered. Cover any remaining stages in a single question each and aim to reach "complete" within about three more turns. Prefer finishing with a gap in extractedData over asking another follow-up.`
  }
  return ''
}

export async function conductInterview(
  history: InterviewMessage[],
  verificationContext: Record<string, VerificationResult>
): Promise<{ response: TaylorResponse; verification: VerificationResult | null }> {
  // Build the messages array for Claude
  const messages: Anthropic.MessageParam[] = []

  // Convert history to Claude message format
  for (const msg of history) {
    messages.push({
      role: msg.role === 'taylor' ? 'assistant' : 'user',
      content: msg.role === 'taylor'
        // Taylor messages: pass the raw JSON so Claude sees its previous structured output
        ? msg.content
        : buildSellerTurn(msg.content, verificationContext),
    })
  }

  // If history is empty this is the opening message
  if (messages.length === 0) {
    messages.push({
      role: 'user',
      content: '[SYSTEM: The seller has just landed on the application page. Send your opening welcome message.]',
    })
  }

  // The prompt requires every extractedData field to be re-emitted each turn, so
  // the JSON grows as the seller fills fields with prose (differentiation and
  // sourcingDetails especially). At 600 the reply started getting cut mid-JSON,
  // which parseJsonFromText can't recover — it falls back to stripping braces
  // off the raw text, producing the half-sentence Taylor the seller sees.
  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: SYSTEM_PROMPT + pacingDirective(history),
    messages,
  })

  // Truncation must not stay silent: the fallback below emits something that
  // reads like a real reply, so without this the only symptom is Taylor
  // talking nonsense.
  if (result.stop_reason === 'max_tokens') {
    console.error('[interview] response hit max_tokens — reply will be truncated JSON')
  }

  const raw = result.content[0].type === 'text' ? result.content[0].text : '{}'
  const fallback: TaylorResponse = {
    message: raw.replace(/[{}"\[\]]/g, '').slice(0, 200) || "Sorry, I got a bit turned around there — could you say that again?",
    stage: 'welcome',
    triggerVerification: null,
    extractedData: {},
    complete: false,
    redFlags: [],
  }
  const parsed = parseJsonFromText<TaylorResponse>(raw, fallback)

  // Run any triggered verification synchronously (fast — timeout protected)
  let verification: VerificationResult | null = null

  if (parsed.triggerVerification) {
    const trigger = parsed.triggerVerification

    if (trigger.type === 'nzbn') {
      const data = await lookupNZBN(trigger.value)
      verification = {
        type: 'nzbn',
        success: data !== null && data.entityStatusCode === 'REGISTERED',
        label: data ? nzbnSummary(data) : 'NZBN not found in register',
        data,
      }
      // Update Taylor's message to reference the result
      if (data) {
        parsed.message += ` Found it — ${nzbnSummary(data)}.`
      }
    }

    if (trigger.type === 'url') {
      const data: UrlVerifyResult = await verifyUrl(trigger.value)
      verification = {
        type: 'url',
        success: data.reachable,
        label: data.reachable
          ? `${data.title ?? trigger.value} — reachable`
          : `${trigger.value} — couldn't reach`,
        data,
      }
    }

    if (trigger.type === 'search') {
      const data: SearchResult = await searchBusiness(trigger.query)
      verification = {
        type: 'search',
        success: data.snippets.length > 0,
        label: data.snippets.length > 0
          ? `Found online references for "${trigger.query}"`
          : `No strong online presence found for "${trigger.query}"`,
        data,
      }
      // Append a brief note to Taylor's message
      if (data.snippets.length > 0) {
        parsed.message += ' Found a few references online, which is great.'
      }
    }
  }

  return { response: parsed, verification }
}

// ── Scoring (called at completion) ───────────────────────────────────────────

export async function scoreInterview(
  extracted: Partial<ExtractedData>,
  verifications: Record<string, VerificationResult>,
  history: InterviewMessage[]
): Promise<InterviewScore> {
  const verificationCount = Object.values(verifications).filter((v) => v.success).length
  const verificationScore = Math.min(10, verificationCount * 3.5)

  const conversationText = history
    .map((m) => `${m.role === 'taylor' ? 'Taylor' : 'Seller'}: ${m.content}`)
    .join('\n')

  const prompt = `Rate this seller interview on specificity and consistency. Return JSON only.

Extracted data: ${JSON.stringify(extracted)}
Verifications passed: ${verificationCount} of ${Object.keys(verifications).length}

Conversation:
${conversationText}

Return:
{
  "specificityScore": <0-10, how detailed and differentiated were their product descriptions>,
  "consistencyScore": <0-10, did their answers stay consistent, no contradictions>,
  "summary": "<2 sentences welcoming them and naming their key strength as a seller>"
}`

  try {
    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'You are a seller quality assessor. Respond only with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = result.content[0].type === 'text' ? result.content[0].text : '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const scores = JSON.parse(match?.[0] ?? '{}') as {
      specificityScore: number
      consistencyScore: number
      summary: string
    }

    const specificityScore = Math.min(10, Math.max(0, scores.specificityScore ?? 5))
    const consistencyScore = Math.min(10, Math.max(0, scores.consistencyScore ?? 5))

    const trustTier = deriveTier({
      extracted,
      verifications,
      specificityScore,
      consistencyScore,
      verificationScore,
    })

    return {
      specificityScore,
      consistencyScore,
      verificationScore,
      trustTier,
      summary: scores.summary ?? 'Welcome to taylin.ai!',
    }
  } catch {
    return {
      specificityScore: 5,
      consistencyScore: 5,
      verificationScore,
      trustTier: 3,
      summary: 'Welcome to taylin.ai! Your listing will be reviewed shortly.',
    }
  }
}

// ── Tier derivation ───────────────────────────────────────────────────────────

function deriveTier({
  extracted,
  verifications,
  specificityScore,
  consistencyScore,
  verificationScore,
}: {
  extracted: Partial<ExtractedData>
  verifications: Record<string, VerificationResult>
  specificityScore: number
  consistencyScore: number
  verificationScore: number
}): 1 | 2 | 3 {
  const nzbnValid = verifications.nzbn?.success ?? false
  const websiteVerified = verifications.url?.success ?? false
  const onlinePresence = verifications.search?.success ?? false
  const gst = extracted.gstRegistered ?? false

  // Tier 1: NZBN active + (GST or website verified) + high specificity
  if (nzbnValid && (gst || websiteVerified) && specificityScore >= 7 && consistencyScore >= 6) {
    return 1
  }

  // Tier 2: any 2 verification signals + reasonable specificity + no major inconsistencies
  const verifiedCount = [nzbnValid, websiteVerified, onlinePresence, gst].filter(Boolean).length
  if (verifiedCount >= 2 && specificityScore >= 5 && consistencyScore >= 5) {
    return 2
  }

  // Tier 2 also: 1 strong signal + excellent specificity
  if (verifiedCount >= 1 && specificityScore >= 8) {
    return 2
  }

  return 3
}

// ── Helper ────────────────────────────────────────────────────────────────────

function buildSellerTurn(
  message: string,
  verificationContext: Record<string, VerificationResult>
): string {
  const recentVerifications = Object.entries(verificationContext)
    .map(([key, v]) => `[Verification ${key}: ${v.success ? 'PASSED' : 'FAILED'} — ${v.label}]`)
    .join('\n')

  if (recentVerifications) {
    return `${message}\n\n${recentVerifications}`
  }
  return message
}
