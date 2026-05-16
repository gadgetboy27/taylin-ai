create table searches (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  raw_prompt         text not null,
  parsed_brief       jsonb,
  category           text,
  results_shown      jsonb,
  selected_result_id text,
  created_at         timestamptz not null default now()
);

comment on table searches is
  'Every prompt the user submits. raw_prompt is the original text; parsed_brief is the structured intent JSON.';

create index searches_user_id_created_at_idx on searches(user_id, created_at desc);
