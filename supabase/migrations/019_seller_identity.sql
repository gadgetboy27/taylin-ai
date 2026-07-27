-- Real identity provenance for sellers.
--
-- Until now sellers.identity_verified was set as `scores.trustTier <= 2`
-- (routes/sellers.ts) — derived from the interview score, which lib/tiers.ts
-- then reads back to compute the tier. Circular, and it never represented
-- anyone checking an identity. This records who actually did the checking.
--
-- The practical consequence: a sole trader with no NZBN could not clear
-- identity_verified, so they landed in tier 3 — higher fees, and excluded from
-- the local-seller floor in lib/ranking-fairness.ts, which exists to protect
-- exactly that kind of seller.
alter table sellers
  add column identity_source text
    check (identity_source in ('stripe_connect', 'nzbn', 'manual_admin')),
  add column identity_verified_at timestamptz,
  -- The person accountable for the listing, which is not always the business
  -- name — a sole trader trading as something else, for instance.
  add column legal_name text,
  -- Where they actually sell from. Separate from the postcode/city captured in
  -- 014_geo.sql, which is only ever used for coarse broadcast targeting.
  add column trading_address text,
  -- Existing seller identities elsewhere: [{platform, username, url, since}].
  -- Trade Me and eBay already KYC their sellers and carry public feedback
  -- history, which is far harder to fabricate than a new social account.
  add column marketplace_profiles jsonb not null default '[]';

comment on column sellers.identity_source is
  'How identity was established. stripe_connect = Stripe verified the person during Connect onboarding (regulated KYC, strongest). nzbn = matched against the NZ Business Register. manual_admin = an admin vouched. Null means unverified.';
comment on column sellers.marketplace_profiles is
  'Existing seller accounts on other platforms: [{platform, username, url, since}]. Used as a KYC signal for sellers with no NZBN.';

create index sellers_identity_source_idx on sellers(identity_source)
  where identity_source is not null;
