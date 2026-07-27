-- Nothing has ever created a public.users row. 002_users.sql defines it as a
-- mirror of auth.users but no trigger, insert or upsert exists anywhere in the
-- codebase — routes/auth.ts creates the auth.users row via admin.createUser and
-- stops there. Every real signup therefore authenticates fine and then fails on
-- first write: preferences, searches, orders, monitors and seller_applications
-- all carry a FK to public.users(id), so /intent, /order, /signals and
-- /sellers/apply/start return 500 while /token returns 402 "User not found".
--
-- A trigger rather than an upsert in the API: it fires atomically with user
-- creation and covers every path — OAuth providers, the SMS fallback's
-- admin.createUser, dashboard-created users, future providers — without each
-- one having to remember. SECURITY DEFINER is required because
-- 009_rls_policies.sql restricts users to `auth.uid() = id`, which does not
-- hold while the trigger runs.
--
-- nullif(...,'') on both columns matters: GoTrue stores an empty string rather
-- than null for the identifier a user did not sign up with, and users.email and
-- users.phone are both `text unique` — so a second OAuth signup carrying
-- phone = '' would collide on the unique index. `on conflict (id) do nothing`
-- would not catch that, since the conflict is on phone, not id.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, phone)
  values (new.id, nullif(new.email, ''), nullif(new.phone, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user is
  'Mirrors every new auth.users row into public.users. Without this, any table with a FK to public.users(id) rejects writes for freshly signed-up users.';

-- Backfill anyone who signed up before this trigger existed.
insert into public.users (id, email, phone)
select u.id, nullif(u.email, ''), nullif(u.phone, '')
from auth.users u
left join public.users pu on pu.id = u.id
where pu.id is null
on conflict (id) do nothing;
