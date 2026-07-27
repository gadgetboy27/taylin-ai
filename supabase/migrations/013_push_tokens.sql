-- Push delivery registration (device -> Expo push token) and the actual
-- notification records themselves (for the in-app pull/history feed).
-- Kept as two tables: push_tokens is delivery plumbing, notifications is
-- user-facing content — a user can have zero tokens (push disabled) and
-- still see notifications in-app via pull.

create table push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  updated_at  timestamptz not null default now(),
  unique (user_id, token)
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_id_created_at_idx on notifications(user_id, created_at desc);

alter table push_tokens   enable row level security;
alter table notifications enable row level security;

create policy "push_tokens: own rows only"
  on push_tokens for all
  using (auth.uid() = user_id);

create policy "notifications: own rows only"
  on notifications for all
  using (auth.uid() = user_id);

comment on table notifications is
  'User-facing notification feed (pull side). Writes come from the API service role via lib/push.ts, never directly from clients.';
