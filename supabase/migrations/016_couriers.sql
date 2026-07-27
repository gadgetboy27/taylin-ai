-- Curated courier directory + aggregate rating, matching the
-- sellers.dispute_rate/total_orders convention rather than a separate
-- per-transaction reviews table. TrackingMore (lib/trackingmore.ts) does the
-- actual tracking-status lookups — this table is purely Taylin's own
-- selection/rating layer on top of it.
create table couriers (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  contact_info              text,
  service_area              text,
  trackingmore_carrier_code text,
  total_deliveries          integer not null default 0,
  rating_sum                integer not null default 0,
  avg_rating                numeric not null default 0 check (avg_rating >= 0 and avg_rating <= 5),
  created_at                timestamptz not null default now()
);

alter table couriers enable row level security;

create policy "couriers: public read"
  on couriers for select
  using (true);

-- orders.tracking_number/tracking_provider already exist (007_orders.sql)
-- but were never read or written anywhere — this finally gives them a
-- purpose. courier_id is nullable: most orders still ship seller-direct,
-- with no courier assignment at all.
alter table orders
  add column courier_id uuid references couriers(id),
  -- Informational only, from the TrackingMore webhook — never drives escrow
  -- release or order.status transitions (see routes/couriers.ts webhook handler).
  add column tracking_status_hint text;

create index orders_courier_id_idx on orders(courier_id) where courier_id is not null;

comment on table couriers is
  'Curated courier directory for the seller "can''t deliver myself" fallback. avg_rating accrues from completed deliveries via POST /couriers/:id/rate.';
