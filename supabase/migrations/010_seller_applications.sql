-- Seller interview applications
-- Stores the full conversation + live verification results + extracted truth-layer data

create table seller_applications (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references users(id) on delete cascade,
  status                text not null default 'in_progress'
                          check (status in ('in_progress', 'complete', 'rejected')),

  -- Full conversation as [{role:'taylor'|'seller', content:'...', ts:'...'}]
  conversation          jsonb not null default '[]',

  -- Structured data extracted during the interview
  extracted_data        jsonb not null default '{}',

  -- Results of each online check: {nzbn:{success,data}, url:{success,data}, search:{success,data}}
  verification_results  jsonb not null default '{}',

  -- Final scoring
  specificity_score     numeric(4,2),       -- 0–10: how detailed/differentiated were their answers
  consistency_score     numeric(4,2),       -- 0–10: did online evidence match what they said
  verification_score    numeric(4,2),       -- 0–10: how many checks passed
  trust_tier            integer check (trust_tier in (1, 2, 3)),

  -- Linked seller row once approved
  seller_id             uuid references sellers(id),

  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

comment on table seller_applications is
  'One row per seller onboarding interview. Conversation + verification results stored here; '
  'a sellers row is created only on completion.';

-- Add interview columns to sellers for display
alter table sellers
  add column if not exists nzbn                  text,
  add column if not exists website_url           text,
  add column if not exists online_verified       boolean not null default false,
  add column if not exists verification_summary  jsonb,
  add column if not exists truth_layer           jsonb;

comment on column sellers.truth_layer is
  'Structured product/business data extracted during AI interview — '
  'used by the ranking AI to match sellers to buyer intent.';
