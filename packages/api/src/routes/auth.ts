import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── Lazy Twilio init ──────────────────────────────────────────────────────────
function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Twilio = require('twilio') as (sid: string, token: string) => {
    messages: { create: (opts: Record<string, string>) => Promise<void> }
  }
  return Twilio(sid, token)
}

// ── In-memory OTP store (replaced with DB row in production) ──────────────────
const pending = new Map<string, { code: string; expiresAt: number }>()

function normalise(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // NZ landlines (09xxxxxxx = 9 digits) and mobiles (02xxxxxxxx = 10 digits)
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) return `+64${digits.slice(1)}`
  return digits.startsWith('0') ? `+64${digits.slice(1)}` : raw.startsWith('+') ? `+${digits}` : `+${digits}`
}

// ── POST /auth/sms/send ───────────────────────────────────────────────────────
app.post(
  '/sms/send',
  zValidator('json', z.object({ phone: z.string().min(7).max(20) })),
  async (c) => {
    const phone = normalise(c.req.valid('json').phone)
    const code = String(Math.floor(100000 + Math.random() * 900000))
    pending.set(phone, { code, expiresAt: Date.now() + 10 * 60 * 1000 })

    const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)

    if (hasTwilio) {
      const from = process.env.TWILIO_PHONE_NUMBER ?? process.env.TWILIO_MESSAGING_SERVICE_SID
      if (!from) return c.json({ error: 'Set TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID' }, 500)
      try {
        await getTwilioClient().messages.create({
          to: phone, from,
          body: `Your taylin.ai code: ${code}. Expires in 10 min.`,
        })
        return c.json({ sent: true })
      } catch (err) {
        console.error('[sms] send failed:', err)
        return c.json({ error: 'SMS send failed' }, 500)
      }
    }

    // Dev: no Twilio keys — log code and return it so you can type it
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n📱 DEV SMS — ${phone} → code: ${code}\n`)
      return c.json({ sent: true, devCode: code })
    }

    return c.json({ error: 'SMS not configured' }, 503)
  }
)

// ── POST /auth/sms/verify ─────────────────────────────────────────────────────
app.post(
  '/sms/verify',
  zValidator('json', z.object({
    phone: z.string().min(7).max(20),
    code: z.string().length(6),
  })),
  async (c) => {
    const phone = normalise(c.req.valid('json').phone)
    const { code } = c.req.valid('json')

    const entry = pending.get(phone)
    if (!entry) return c.json({ error: 'No code sent to this number — request one first' }, 400)
    if (Date.now() > entry.expiresAt) {
      pending.delete(phone)
      return c.json({ error: 'Code expired — request a new one' }, 400)
    }
    if (entry.code !== code) return c.json({ error: 'Incorrect code' }, 400)
    pending.delete(phone)

    const supabaseAdmin = getSupabaseAdmin()
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const existing = users.find(
      (u) => u.phone === phone || u.user_metadata?.phone === phone
    )

    // For new users: create a Supabase account keyed to their phone number.
    // Email is a generated stub they can update later — SMS is the identity.
    let targetEmail = existing?.email
    if (!targetEmail) {
      const stub = `${phone.replace(/^\+/, '')}_phone@taylin.ai`
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: stub,
        email_confirm: true,
        user_metadata: { phone },
      })
      if (createErr || !created?.user) return c.json({ error: 'Could not create account' }, 500)
      targetEmail = stub
    }

    // Generate an admin magic-link token — frontend exchanges it for a real session
    // (no email is sent; admin-issued token bypasses rate limits and email delivery)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
    })
    if (error || !data) return c.json({ error: 'Could not create session' }, 500)

    return c.json({
      verified: true,
      // Frontend calls supabase.auth.verifyOtp({ email, token, type: 'email' })
      email: targetEmail,
      token: data.properties.email_otp,
    })
  }
)

export const authRoute = app
