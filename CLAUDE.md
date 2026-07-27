# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Project: taylin.ai

NZ-first buyer's agent. Voice or text intent → parallel marketplace search → ranked results → escrowed purchase. Sellers onboard through an AI interview ("Taylor") that builds a verifiable truth layer.

## Layout

npm workspaces + turbo:
- `apps/mobile` — Expo Router, TypeScript
- `packages/api` — Hono on Node, **ESM: relative imports need the `.js` extension**
- `supabase/migrations` — numbered SQL, applied in order

Commands: `npm run mobile` · `npm run api` · `npm run typecheck` (runs both workspaces). No test suite exists yet.

## Invariants — don't break these

- **AI keys never leave `packages/api/src/lib/ai-wrapper.ts`.** Every model call routes through it. Nothing AI-related belongs in the mobile app.
- **`.env` files stay gitignored.** Secrets live in `packages/api/.env` and `apps/mobile/.env`, never in source. The mobile app only ever receives `EXPO_PUBLIC_*` values.
- **Ranking fairness is deterministic, not prompted.** `lib/ranking-fairness.ts` reserves `FLOOR_SLOTS` of the top 10 for qualifying local sellers *after* the LLM ranks. A fairness guarantee has to be auditable — never fold it into a prompt.
- **Two distinct fraud modules.** `lib/fraud.ts` = buyer spend limits before issuing a payment token. `lib/seller-fraud.ts` = seller KYC/enforcement. Don't merge them.
- **`sellers.trust_tier` ≠ `sellers.status`.** Tier = verification quality, drives fee % and escrow rules (`lib/tiers.ts`). Status = active enforcement action. Enforcement only ever tightens; `banned` is admin-only.
- **Auth is opt-in per route.** `src/index.ts` gates most paths with `app.use(...)`, but newer routes (`deals`, `couriers`) attach `authMiddleware` per-handler instead so public reads stay public. Mounting a route does *not* protect it — decide and wire auth explicitly.

## Deliberately provisional

- `lib/broadcast.ts` geo tiers are a strawman. Only postcode/city exist (`014_geo.sql` — no lat/lng, by choice, to avoid the GPS permission prompt and privacy surface). So `city`/`region` collapse to one query and `national`/`international` to another. The 5-tier enum is kept so the schema survives finer location data later.
- Escrow is a stub pointing at SafeSend (`apps/mobile/lib/safesend.ts`).

## Current state (2026-07-27)

- Supabase project `msdrnmgqbhjlnqhrniif` (taylin-ai, ap-southeast-2) is live with all 17 migrations applied. Credentials are in `packages/api/.env`; **`apps/mobile/.env` still points at the old project and needs the new `EXPO_PUBLIC_*` values.**
- 12 tables: users, preferences, searches, sellers, products, orders, monitors, seller_applications, push_tokens, notifications, deals, couriers. All have RLS enabled.
- Migrations are applied via the Supabase Management API, not the CLI — the `001_`-style filenames aren't the timestamps `supabase db push` expects, so **nothing is recorded in `supabase_migrations.schema_migrations`.** Track what's applied by hand, or renumber before adopting the CLI.
- **New tables must enable RLS in their own migration.** `009_rls_policies.sql` only covered the tables that existed then; `seller_applications` was added later and sat world-readable until `017` caught it.
- Search adapters wired: Trade Me, eBay, Brave web, AliExpress, Amadeus (flights), plus internal sellers.
- Keys present: Anthropic, Gemini, Brave (search + answers), eBay, Deepgram, TrackingMore. Still empty: Trade Me, Amadeus, NZBN, Twilio, Stripe, AliExpress.
- `SETUP.md` is stale — it claims 9 migrations and describes a `DEV_SKIP_AUTH` flag that no longer exists.
