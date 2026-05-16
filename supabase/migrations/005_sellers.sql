create table sellers (
  id                        uuid primary key default gen_random_uuid(),
  business_name             text not null,
  contact_email             text not null,
  stripe_connect_account_id text,
  trust_tier                integer not null default 2 check (trust_tier in (1, 2, 3)),
  catalogue_url             text,
  catalogue_last_synced     timestamptz,
  gst_registered            boolean not null default false,
  identity_verified         boolean not null default false,
  total_orders              integer not null default 0,
  dispute_rate              numeric not null default 0 check (dispute_rate >= 0 and dispute_rate <= 1),
  fee_override              numeric,
  onboarded_at              timestamptz,
  created_at                timestamptz not null default now()
);

comment on table sellers is
  'Seller directory. trust_tier is auto-assigned: 1=verified retailer, 2=marketplace, 3=p2p individual.';
comment on column sellers.stripe_connect_account_id is
  'Stripe Connect account for payouts. Never store bank details here — Stripe owns that.';

create index sellers_trust_tier_idx on sellers(trust_tier);
