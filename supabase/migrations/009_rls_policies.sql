-- ─── Enable Row Level Security on all user-scoped tables ──────────────────────
alter table users      enable row level security;
alter table preferences enable row level security;
alter table searches   enable row level security;
alter table orders     enable row level security;
alter table monitors   enable row level security;

-- Products and sellers are read-public, write-admin-only
alter table products   enable row level security;
alter table sellers    enable row level security;

-- ─── Users ────────────────────────────────────────────────────────────────────
create policy "users: own row only"
  on users for all
  using (auth.uid() = id);

-- ─── Preferences ──────────────────────────────────────────────────────────────
create policy "preferences: own rows only"
  on preferences for all
  using (auth.uid() = user_id);

-- ─── Searches ─────────────────────────────────────────────────────────────────
create policy "searches: own rows only"
  on searches for all
  using (auth.uid() = user_id);

-- ─── Orders ───────────────────────────────────────────────────────────────────
create policy "orders: own rows only"
  on orders for all
  using (auth.uid() = user_id);

-- ─── Monitors ─────────────────────────────────────────────────────────────────
create policy "monitors: own rows only"
  on monitors for all
  using (auth.uid() = user_id);

-- ─── Products — public read, no direct write from clients ─────────────────────
create policy "products: public read"
  on products for select
  using (true);

-- Writes come from service role only (catalogue sync jobs) — no INSERT policy for users.

-- ─── Sellers — public read ────────────────────────────────────────────────────
create policy "sellers: public read"
  on sellers for select
  using (true);
