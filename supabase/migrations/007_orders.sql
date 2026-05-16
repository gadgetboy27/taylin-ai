create type order_status as enum (
  'pending',
  'escrowed',
  'shipped',
  'delivered',
  'disputed',
  'released',
  'refunded'
);

create table orders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references users(id),
  seller_id                uuid references sellers(id),
  product_id               uuid references products(id),
  search_id                uuid references searches(id),
  status                   order_status not null default 'pending',
  amount                   numeric not null check (amount > 0),
  currency                 text not null default 'NZD',
  platform_fee             numeric,
  stripe_payment_intent_id text,
  stripe_token_id          text,
  escrow_held              boolean not null default false,
  tracking_number          text,
  tracking_provider        text,
  escrow_release_at        timestamptz,
  buyer_confirmed_at       timestamptz,
  created_at               timestamptz not null default now()
);

comment on table orders is
  'Every purchase. stripe_token_id is the scoped Issuing card token — one per order, never reused.';
comment on column orders.stripe_token_id is
  'Single-use Stripe Issuing virtual card token. Expired after one authorization.';

create index orders_user_id_created_at_idx on orders(user_id, created_at desc);
create index orders_status_escrow_idx on orders(status, escrow_release_at)
  where escrow_held = true;
