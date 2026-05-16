create table users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  phone               text unique,
  email               text unique,
  display_name        text,
  stripe_customer_id  text unique,
  stripe_issuing_card_id text,
  spend_limit_per_tx  numeric not null default 200,
  spend_limit_monthly numeric not null default 2000,
  accessibility_mode  boolean not null default false,
  speech_preferred    boolean not null default false,
  agent_personality   text not null default 'default',
  created_at          timestamptz not null default now()
);

comment on table users is
  'One row per authenticated user. Mirrors auth.users. Stripe IDs stored here, never PAN data.';

create index users_stripe_customer_id_idx on users(stripe_customer_id)
  where stripe_customer_id is not null;
