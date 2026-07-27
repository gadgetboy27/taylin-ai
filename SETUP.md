# taylin.ai — Setup Guide

## What's built

| Layer | Status | Notes |
|-------|--------|-------|
| Mobile app (Expo) | ✅ Ready | 4 themes, voice, search, deals, seller dashboard |
| Backend API (Hono) | ✅ Ready | 17 route groups, runs on port 3001 |
| Database schema | ✅ Live | 17 migrations applied to the `taylin-ai` Supabase project |
| Auth (SMS OTP) | ✅ Enforced | Twilio via `/auth/sms/send`; falls back to a logged dev code |
| Voice (speech-to-text) | ✅ Ready | Deepgram server-side; `expo-speech-recognition` on device |
| Search adapters | 🔑 Partial | eBay + Brave live; Trade Me / Amadeus / AliExpress need keys |
| Escrow | 🔌 Stub | Wired to SafeSend — see below |
| Payments (Stripe) | 🔌 Stub | Needs real keys + Issuing approval |
| Admin routes | 🔒 Locked | Need `ADMIN_API_KEY` set — currently 401 on every request |

---

## Run it

```bash
npm install

# Terminal 1 — API on :3001
npm run api

# Terminal 2 — Expo
npm run mobile
```

Voice needs a **physical device** and a **dev build** (see below) — simulators can't reach the mic, and Expo Go can't load the native speech module.

### Signing in without Twilio

Twilio keys are optional in dev. With them unset, `POST /auth/sms/send` prints the code to the API console and returns it as `devCode` in the response, so you can sign in on a real number without sending an SMS.

```
📱 DEV SMS — +64211234567 → code: 481920
```

> Dev stub results (the three Ethiopian coffee cards) only appear when `EXPO_PUBLIC_SUPABASE_URL` is unset. Now that it points at a real project, searches hit the real pipeline — and the database is empty, so internal-seller results will be too until you seed some.

---

## Themes

Switch between all 4 themes from any screen using the emoji buttons top-left:

| Emoji | Theme | Vibe |
|-------|-------|------|
| ☀️ | Light | Clean white |
| 🌙 | Dark | Deep black |
| 🐾 | Snails & Tails | Forest green, puppy brown |
| 🌸 | Sugar & Spice | Deep rose, lavender |

---

## Credentials

All server keys live in `packages/api/.env`; the mobile app only ever gets `EXPO_PUBLIC_*` values. Both files are gitignored. Copy `packages/api/.env.example` for the full annotated list.

### Already configured

Supabase, Anthropic, Gemini, Brave (search + AI answers), eBay, Deepgram, TrackingMore.

### Still needed

| Key | Unlocks | Where |
|-----|---------|-------|
| `TWILIO_*` | Real SMS instead of the dev code | console.twilio.com |
| `STRIPE_SECRET_KEY` | Payments, escrow, Issuing cards | dashboard.stripe.com |
| `ADMIN_API_KEY` | `/admin/*` seller review queue (any random string) | pick one |
| `TRADEME_*` | NZ marketplace results | developer.trademe.co.nz |
| `AMADEUS_*` | Flights and hotels | developers.amadeus.com |
| `ALIEXPRESS_*` | AliExpress results | portals.aliexpress.com |
| `NZBN_API_KEY` | NZ business register seller checks | api.business.govt.nz |

Stripe Issuing needs manual approval from Stripe: dashboard.stripe.com → Products → Issuing.

---

## Database

The schema is already applied to the live project. You only need this section to set up a **new** Supabase project.

Migrations are numbered `001_` … `017_` and must run **in order** — later ones alter tables the earlier ones create.

⚠️ **`npx supabase db push` will not work.** The CLI expects timestamp-prefixed filenames (`20240101000000_name.sql`), not `001_`. Apply them one of these ways instead:

- Paste each file into the Supabase SQL editor in order, or
- POST each file to the Management API:
  ```
  POST https://api.supabase.com/v1/projects/{ref}/database/query
  Authorization: Bearer <personal access token>
  { "query": "<file contents>" }
  ```

Because neither path records anything in `supabase_migrations.schema_migrations`, **nothing tracks which migrations have run** — keep note by hand, or renumber to timestamps before adopting the CLI.

### Rules for new migrations

**Enable RLS in the same migration that creates the table.** `009_rls_policies.sql` only covered the tables existing at the time; `seller_applications` was added in `010` and sat world-readable to the anon key until `017` caught it. Service-role-only tables still want `enable row level security` with no policy — that's deny-all for clients and a no-op for the API.

---

## Architecture notes

- **All AI calls go through `packages/api/src/lib/ai-wrapper.ts`.** No model keys exist anywhere else, and none reach the mobile app.
- **Search runs every adapter in parallel** (Trade Me, eBay, Brave, AliExpress, internal sellers), then ranks. Unconfigured adapters skip themselves with a startup warning.
- **`lib/ranking-fairness.ts` reserves 2 of the top 10 slots** for relevance-qualified local sellers, applied deterministically *after* the LLM ranks — a fairness guarantee shouldn't depend on a prompt.
- **Seller trust has two axes:** `trust_tier` (verification quality → fee % and escrow rules) and `status` (enforcement: active/flagged/suspended/banned). Enforcement only ever tightens; bans are admin-only.
- **`lib/broadcast.ts` geo tiers are a strawman** pending real usage data. Only postcode/city exist — no lat/lng, deliberately, to avoid the GPS permission prompt.

---

## SafeSend Escrow Integration

taylin.ai uses your SafeSend app for all escrow instead of building its own.

**The stub is at:** `apps/mobile/lib/safesend.ts`

To wire it up:
1. Set `EXPO_PUBLIC_SAFESEND_API_URL` in `apps/mobile/.env` to your SafeSend URL
2. Set `SAFESEND_API_URL` and `SAFESEND_API_KEY` in `packages/api/.env`
3. The `createEscrow`, `releaseEscrow`, `disputeEscrow` functions in `safesend.ts` are already shaped — replace the fetch calls with your SafeSend endpoints

This means:
- taylin.ai handles: search → select → payment token → order record
- SafeSend handles: funds hold → dispute → release → payout

---

## Voice — getting it working

Voice requires a **physical device** (not a simulator) and an **Expo Development Build** (not Expo Go), because `expo-speech-recognition` uses native modules.

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios   # or android
```

Then scan the QR from `npm run mobile` with your dev build.

Without EAS:

```bash
cd apps/mobile
npx expo run:ios --device      # requires Xcode + Apple Developer account
npx expo run:android --device  # requires Android Studio
```

---

## Project structure

```
taylin-ai/
├── apps/mobile/          # Expo app — the thing users see
│   ├── app/              # Screens (Expo Router)
│   │   ├── (auth)/       # Phone + code sign-in
│   │   ├── (tabs)/       # Home, agent, history, wallet
│   │   ├── seller/       # Apply, dashboard, post-deal
│   │   └── deals/
│   ├── components/
│   ├── context/          # Theme, voice, notifications, patterns
│   ├── hooks/
│   ├── lib/
│   │   ├── patterns/     # On-device habit detection
│   │   └── safesend.ts   # ← SafeSend integration point
│   └── constants/
│       └── themes.ts     # ← 4 themes defined here
├── packages/api/         # Hono backend — all secret keys live here
│   └── src/
│       ├── lib/
│       │   └── ai-wrapper.ts  # ← ALL AI calls go through here
│       ├── middleware/   # auth, admin, rate limit, validate
│       └── routes/
└── supabase/
    └── migrations/       # Run these in order (001 → 017)
```

---

## Known issues

- `npm run typecheck` fails with 3 pre-existing errors in `lib/deepgram.ts` (Buffer→BodyInit), `lib/stripe.ts` (stale `apiVersion` string), and `lib/trademe.ts` (implicit any index). The mobile workspace is clean.
- `middleware/admin.ts` is a static shared key, not a role system — there's no admin concept on `users` yet. Replace before any real launch.
- The `/research` rate limiter is in-memory and per-process; it needs a shared store if the API ever runs more than one instance.

---

## Quick dev checklist

- [ ] `npm run api` starts and `curl localhost:3001/health` returns `{"ok":true}`
- [ ] `npm run mobile` boots to the sign-in screen
- [ ] Sign in with the `devCode` printed in the API console
- [ ] All 4 theme emojis switch theme correctly
- [ ] Typing in the prompt bar returns ranked results
- [ ] Voice button works on a physical device (needs a dev build)
- [ ] Set `ADMIN_API_KEY` → `/admin/sellers` review queue reachable
- [ ] Point `EXPO_PUBLIC_SAFESEND_API_URL` at SafeSend → escrow live
