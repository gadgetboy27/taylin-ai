create type monitor_type as enum ('price_drop', 'availability', 'date');

create table monitors (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,
  search_id            uuid references searches(id),
  monitor_type         monitor_type not null,
  target_price         numeric,
  route                text,
  check_interval_hours integer not null default 4,
  last_checked         timestamptz,
  triggered_at         timestamptz,
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

comment on table monitors is
  'Buy signal monitors. Background job polls active monitors every check_interval_hours.';

create index monitors_active_idx on monitors(active, last_checked)
  where active = true;
create index monitors_user_id_idx on monitors(user_id);
