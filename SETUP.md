# taylin.ai — Setup Guide

## What's built

| Layer | Status | Notes |
|-------|--------|-------|
| Mobile app (Expo) | ✅ Ready | 4 themes, voice, all screens |
| Backend API (Hono) | ✅ Ready | Runs without credentials in dev |
| Database schema | ✅ Ready | 9 migrations, run when you add Supabase |
| Voice (speech-to-text) | ✅ Ready | Uses `expo-speech-recognition` |
| Escrow | 🔌 Stub | Wired to SafeSend — see below |
| Auth | ⏭️ Bypassed | `DEV_SKIP_AUTH = true` in `app/_layout.tsx` |

---

## Run it right now (no credentials needed)

The app boots in dev mode with stubs — fake search results, no real DB calls.

```bash
# 1. Start the mobile app
cd apps/mobile
npx expo start

# Scan the QR code with Expo Go on your phone
# OR press i for iOS simulator, a for Android emulator
```

Voice will work on a **physical device** (Expo Go). Simulators can't access the mic.

---

## Themes

Switch between all 4 themes from any screen using the emoji buttons top-left:

| Emoji | Theme | Vibe |
|-------|-------|------|
| ☀️ | Light | Clean white |
| 🌙 | Dark | Deep black |
| 🐾 | Snails & Tails (boys) | Forest green, puppy brown |
| 🌸 | Sugar & Spice (girls) | Deep rose, lavender |

---

## Adding real credentials

### 1. Supabase (for real data + auth)

1. Go to [supabase.com](https://supabase.com) → create a project
2. Settings → API → copy URL and anon key
3. Paste into `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. Copy service role key → paste into `packages/api/.env`:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
5. Run migrations:
   ```bash
   npx supabase db push
   # OR paste each supabase/migrations/*.sql into Supabase SQL editor in order
   ```

### 2. AI keys (for real intent parsing + ranking)

```
# packages/api/.env
GEMINI_API_KEY=       # aistudio.google.com → Get API key (free)
ANTHROPIC_API_KEY=    # console.anthropic.com → API keys
```

### 3. Stripe Issuing (for real payments)

```
# packages/api/.env
STRIPE_SECRET_KEY=sk_test_...    # dashboard.stripe.com → Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_...  # set up a webhook endpoint first
```

Note: Stripe Issuing requires manual approval from Stripe. Apply at:
dashboard.stripe.com → Products → Issuing

### 4. Run the API server

```bash
cd packages/api
npm run dev
# Runs on http://localhost:3000
```

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

Both apps benefit: SafeSend gets real transaction volume for testing, taylin.ai gets a battle-tested escrow system on day one.

---

## Enable auth (when ready)

1. Open `apps/mobile/app/_layout.tsx`
2. Change `const DEV_SKIP_AUTH = true` → `false`
3. Users will be routed through `app/(auth)/welcome.tsx` → `app/(auth)/verify.tsx`
4. Auth is phone number OTP via Supabase (requires Supabase credentials above)

---

## Voice — getting it working

Voice requires:
- A **physical device** (not simulator)
- **Expo Development Build** (not Expo Go) — because `expo-speech-recognition` uses native modules

### Build dev client

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to Expo
eas login

# Build development client for iOS
eas build --profile development --platform ios

# OR for Android
eas build --profile development --platform android
```

Then scan the QR from `npx expo start` with your dev build (not Expo Go).

### Alternatively — run on physical device without EAS

```bash
# iOS (requires Xcode + Apple Developer account)
cd apps/mobile
npx expo run:ios --device

# Android (requires Android Studio)
npx expo run:android --device
```

---

## Project structure

```
taylin-ai/
├── apps/mobile/          # Expo app — the thing users see
│   ├── app/              # Screens (Expo Router)
│   ├── components/       # UI components
│   ├── hooks/            # React hooks
│   ├── lib/              # Client utilities
│   │   └── safesend.ts   # ← SafeSend integration point
│   └── constants/
│       └── themes.ts     # ← 4 themes defined here
├── packages/api/         # Hono backend — all AI keys live here
│   └── src/
│       ├── lib/
│       │   └── ai-wrapper.ts  # ← ALL AI calls go through here
│       └── routes/
└── supabase/
    └── migrations/       # Run these in order (001 → 009)
```

---

## Quick dev checklist

- [ ] `npx expo start` runs without errors
- [ ] App opens on device showing `taylin.ai` wordmark
- [ ] All 4 theme emojis switch theme correctly
- [ ] Typing in prompt bar works
- [ ] Fake search results appear (3 Ethiopian coffee cards in dev mode)
- [ ] Voice button shows on prompt bar
- [ ] Voice works on physical device (requires dev build)
- [ ] Fill in Supabase credentials → flip `DEV_SKIP_AUTH = false` → auth flow works
- [ ] Fill in AI keys → real intent parsing works
- [ ] Point `EXPO_PUBLIC_SAFESEND_API_URL` at SafeSend → escrow live
