-- Time- or quantity-boxed seller offers. Kept separate from `products` —
-- expiry and quantity-remaining semantics don't apply to a normal catalogue
-- listing, and conflating them would force every product query to filter
-- out expired one-offs.
create table deals (
  id                    uuid primary key default gen_random_uuid(),
  seller_id             uuid not null references sellers(id) on delete cascade,
  title                 text not null,
  description           text,
  price                 numeric not null check (price >= 0),
  currency              text not null default 'NZD',
  quantity_original     integer not null check (quantity_original > 0),
  quantity_remaining    integer not null check (quantity_remaining >= 0),
  expires_at            timestamptz not null,
  status                text not null default 'active'
                          check (status in ('active', 'expired', 'sold_out', 'cancelled')),
  -- Broadcast expansion state (see lib/broadcast.ts) — starts local, steps
  -- outward on the cron tick if quantity remains relative to time left.
  broadcast_radius_tier text not null default 'local'
                          check (broadcast_radius_tier in ('local', 'city', 'region', 'national', 'international')),
  notified_count        integer not null default 0,
  -- Buyers already notified for this deal, across all tiers so far — checked
  -- before each tier expansion so a buyer whose postcode qualifies at
  -- multiple tiers (e.g. already in the 'local' tier) never gets a repeat
  -- notification for the same deal.
  notified_user_ids     uuid[] not null default '{}',
  created_at            timestamptz not null default now()
);

create index deals_seller_id_idx on deals(seller_id);
create index deals_status_idx on deals(status) where status = 'active';
create index deals_expires_at_idx on deals(expires_at) where status = 'active';

alter table deals enable row level security;

create policy "deals: public read"
  on deals for select
  using (true);

-- Writes come from the API service role only (seller creation via
-- routes/deals.ts, which checks sellers.status/owner_user_id itself) — no
-- insert/update policy for direct client writes.

comment on table deals is
  'Time- or quantity-limited seller offers, broadcast local-first (see lib/broadcast.ts). Distinct from products.';
