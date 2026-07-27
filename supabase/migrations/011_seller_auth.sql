-- Links a seller record back to the buyer identity that completed the Taylor
-- interview, so the same person can log in (via the existing SMS-OTP flow)
-- and reach a seller dashboard. Nullable because existing sellers predate
-- this column and are not required to backfill immediately.
alter table sellers
  add column owner_user_id uuid references auth.users(id) on delete set null;

create index sellers_owner_user_id_idx on sellers(owner_user_id)
  where owner_user_id is not null;

comment on column sellers.owner_user_id is
  'The auth.users identity that owns this seller profile. Set on interview completion. A seller has no separate login — they authenticate as this user via the existing SMS-OTP flow.';

-- A user starts as a buyer; completing the seller interview upgrades them to
-- 'both' rather than replacing their buyer identity.
alter table users
  add column role text not null default 'buyer'
    check (role in ('buyer', 'seller', 'both'));

comment on column users.role is
  'buyer|seller|both. Set to both automatically when a user completes seller onboarding (see sellers.owner_user_id).';
