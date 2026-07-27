-- Development seed data. Not a migration — this is sample content, not schema,
-- and is safe to re-run (fixed UUIDs + on conflict do nothing).
--
-- Covers the cases the search pipeline actually branches on:
--   * trust tiers 1/2/3, so lib/tiers.ts fee and escrow rules differ per seller
--   * one flagged seller, which routes/search.ts must exclude entirely
--     (`.eq('sellers.status','active')`) rather than merely rank lower
--   * spread across NZ cities/postcodes, so lib/broadcast.ts tier expansion
--     has somewhere to expand to
--   * out-of-stock and over-priced products, which the search filters drop
--
-- Products are what search ranks; deals are the separate time-boxed offer
-- feature. Both are seeded because seeding sellers alone leaves search empty.

-- ─── Dev user ─────────────────────────────────────────────────────────────────
-- middleware/auth.ts accepts the fixed token 'dev-test-token' outside
-- production and maps it to this exact UUID, so curl/Postman testing works
-- without a real session. The bypass is inert unless the user actually
-- exists, and nothing creates public.users automatically — there's no trigger
-- on auth.users. auth.users itself is Supabase-managed, so create that half
-- through the Admin API first, then run this file:
--
--   POST {SUPABASE_URL}/auth/v1/admin/users
--   Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
--   { "id": "dc4b0d2e-ff4b-4586-b070-8bc034502082",
--     "email": "henrypeti.dev@gmail.com", "phone": "+64211111111",
--     "email_confirm": true, "phone_confirm": true }
--
-- Skipped silently if that step hasn't run, since users.id references auth.users.
insert into users (id, phone, email, display_name, role, postcode, city)
select 'dc4b0d2e-ff4b-4586-b070-8bc034502082', '+64211111111',
       'henrypeti.dev@gmail.com', 'Dev User', 'buyer', '6011', 'Wellington'
where exists (select 1 from auth.users where id = 'dc4b0d2e-ff4b-4586-b070-8bc034502082')
on conflict (id) do nothing;

-- ─── Sellers ──────────────────────────────────────────────────────────────────
insert into sellers (
  id, business_name, contact_email, trust_tier, gst_registered, identity_verified,
  total_orders, dispute_rate, status, address_text, postcode, city,
  nzbn, website_url, online_verified, onboarded_at
) values
  ('a1111111-1111-4111-8111-111111111111', 'Havana Coffee Works', 'orders@havana.example.nz',
   1, true, true, 412, 0.004, 'active', '163 Tory Street, Te Aro', '6011', 'Wellington',
   '9429041234567', 'https://havana.example.nz', true, now() - interval '14 months'),

  ('a2222222-2222-4222-8222-222222222222', 'Ponsonby Road Vintage', 'hello@ponsonbyvintage.example.nz',
   2, true, true, 96, 0.031, 'active', '254 Ponsonby Road', '1011', 'Auckland',
   '9429042345678', 'https://ponsonbyvintage.example.nz', true, now() - interval '7 months'),

  ('a3333333-3333-4333-8333-333333333333', 'Southern Alps Outdoors', 'gear@southernalps.example.nz',
   1, true, true, 288, 0.011, 'active', '32 Shotover Street', '9300', 'Queenstown',
   '9429043456789', 'https://southernalps.example.nz', true, now() - interval '2 years'),

  ('a4444444-4444-4444-8444-444444444444', 'Waikato Tech Exchange', 'sales@waikatotech.example.nz',
   2, true, false, 64, 0.058, 'active', '18 Victoria Street', '3204', 'Hamilton',
   null, 'https://waikatotech.example.nz', true, now() - interval '5 months'),

  ('a5555555-5555-4555-8555-555555555555', 'Nelson Makers Collective', 'kia.ora@nelsonmakers.example.nz',
   3, false, false, 11, 0.0, 'active', '7 Bridge Street', '7010', 'Nelson',
   null, null, false, now() - interval '6 weeks'),

  ('a6666666-6666-4666-8666-666666666666', 'Christchurch Auto Parts', 'parts@chchauto.example.nz',
   2, true, true, 173, 0.022, 'active', '441 Blenheim Road, Riccarton', '8041', 'Christchurch',
   '9429044567890', 'https://chchauto.example.nz', true, now() - interval '11 months'),

  -- Flagged: must never appear in search results at all.
  ('a7777777-7777-4777-8777-777777777777', 'Quickfire Clearance', 'admin@quickfire.example.nz',
   3, false, false, 29, 0.310, 'flagged', '1 Queen Street', '1010', 'Auckland',
   null, null, false, now() - interval '3 months')
on conflict (id) do nothing;

-- ─── Products ─────────────────────────────────────────────────────────────────
insert into products (
  id, seller_id, external_id, name, description, price, currency, category,
  delivery_days_min, delivery_days_max, return_policy, stock_available
) values
  -- Coffee — Havana (tier 1, Wellington)
  ('b1111111-0001-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'HAV-001',
   'Ethiopian Yirgacheffe Single Origin Coffee 250g', 'Light roast. Floral, citrus, stone fruit.',
   24.50, 'NZD', 'retail', 1, 3, '30 day return on unopened bags', true),
  ('b1111111-0002-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'HAV-002',
   'Colombian Huila Coffee Beans 1kg', 'Medium roast. Caramel and cocoa. Espresso friendly.',
   62.00, 'NZD', 'retail', 1, 3, '30 day return on unopened bags', true),
  ('b1111111-0003-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'HAV-003',
   'Cold Brew Coffee Concentrate 500ml', 'Ready to pour. Keeps 14 days refrigerated.',
   18.00, 'NZD', 'retail', 1, 2, 'No returns on perishables', true),

  -- Vintage clothing — Ponsonby (tier 2, Auckland)
  ('b2222222-0001-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 'PON-001',
   'Vintage Swanndri Wool Bush Shirt', 'NZ made, 1980s. Olive check. Size L.',
   145.00, 'NZD', 'marketplace', 2, 5, '7 day return, buyer pays postage', true),
  ('b2222222-0002-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 'PON-002',
   'Vintage Levi 501 Denim Jacket', 'Made in USA. Faded indigo. Size M.',
   210.00, 'NZD', 'marketplace', 2, 5, '7 day return, buyer pays postage', true),
  -- Out of stock: search filters this out via stock_available.
  ('b2222222-0003-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 'PON-003',
   'Vintage Barbour Waxed Jacket', 'Sold — kept to exercise the stock filter.',
   380.00, 'NZD', 'marketplace', 2, 5, '7 day return', false),

  -- Outdoor gear — Southern Alps (tier 1, Queenstown)
  ('b3333333-0001-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333', 'SAO-001',
   'Merino Wool Base Layer Long Sleeve', 'NZ merino, 200gsm. Charcoal.',
   119.00, 'NZD', 'retail', 2, 4, '60 day return, unworn', true),
  ('b3333333-0002-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333', 'SAO-002',
   'Waterproof Tramping Jacket 3-Layer', 'Seam sealed, pit zips. Alpine rated.',
   449.00, 'NZD', 'retail', 2, 4, '60 day return, unworn', true),
  ('b3333333-0003-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333', 'SAO-003',
   'Leather Tramping Boots Vibram Sole', 'Full grain leather. Resolable.',
   529.00, 'NZD', 'retail', 3, 6, '60 day return, unworn', true),

  -- Electronics — Waikato Tech (tier 2, Hamilton)
  ('b4444444-0001-4444-8444-444444444444', 'a4444444-4444-4444-8444-444444444444', 'WTE-001',
   'Refurbished Dell Latitude 7420 Laptop i7', '16GB RAM, 512GB SSD. 12 month warranty.',
   899.00, 'NZD', 'retail', 2, 5, '12 month warranty, 14 day change of mind', true),
  ('b4444444-0002-4444-8444-444444444444', 'a4444444-4444-4444-8444-444444444444', 'WTE-002',
   'Refurbished ThinkPad X1 Carbon Laptop', '32GB RAM, 1TB SSD. Gen 9.',
   1450.00, 'NZD', 'retail', 2, 5, '12 month warranty', true),
  ('b4444444-0003-4444-8444-444444444444', 'a4444444-4444-4444-8444-444444444444', 'WTE-003',
   'USB-C Docking Station Dual 4K', 'Triple display, 100W passthrough.',
   239.00, 'NZD', 'retail', 1, 4, '12 month warranty', true),

  -- Craft — Nelson Makers (tier 3, individual)
  ('b5555555-0001-4555-8555-555555555555', 'a5555555-5555-4555-8555-555555555555', 'NMC-001',
   'Handmade Ceramic Coffee Mug', 'Wheel thrown, speckled glaze. 350ml.',
   48.00, 'NZD', 'marketplace', 3, 7, 'No returns, handmade to order', true),
  ('b5555555-0002-4555-8555-555555555555', 'a5555555-5555-4555-8555-555555555555', 'NMC-002',
   'Hand Knitted Merino Wool Beanie', 'NZ merino, natural dye.',
   65.00, 'NZD', 'marketplace', 3, 7, 'No returns, handmade to order', true),

  -- Auto — Christchurch (tier 2)
  ('b6666666-0001-4666-8666-666666666666', 'a6666666-6666-4666-8666-666666666666', 'CAP-001',
   'Toyota Hilux Brake Pad Set Front', 'Fits 2015-2023 Hilux. Ceramic.',
   185.00, 'NZD', 'marketplace', 1, 3, '90 day warranty', true),
  ('b6666666-0002-4666-8666-666666666666', 'a6666666-6666-4666-8666-666666666666', 'CAP-002',
   'Ford Ranger Roof Rack Cross Bars', 'Powder coated steel. 100kg rated.',
   420.00, 'NZD', 'marketplace', 2, 5, '90 day warranty', true),

  -- Flagged seller's stock — must be excluded by the sellers.status filter,
  -- despite matching common queries on name.
  ('b7777777-0001-4777-8777-777777777777', 'a7777777-7777-4777-8777-777777777777', 'QFC-001',
   'Cheap Laptop Clearance Unit', 'Should never surface — seller is flagged.',
   199.00, 'NZD', 'retail', 1, 2, 'No returns', true),
  ('b7777777-0002-4777-8777-777777777777', 'a7777777-7777-4777-8777-777777777777', 'QFC-002',
   'Discount Coffee Beans Bulk 5kg', 'Should never surface — seller is flagged.',
   45.00, 'NZD', 'retail', 1, 2, 'No returns', true)
on conflict (id) do nothing;

-- ─── Deals ────────────────────────────────────────────────────────────────────
-- Mixed expiry windows and broadcast tiers so the cron expansion in
-- lib/broadcast.ts has both fresh local deals and ones due to widen.
insert into deals (
  id, seller_id, title, description, price, currency,
  quantity_original, quantity_remaining, expires_at, status, broadcast_radius_tier, notified_count
) values
  ('c1111111-0001-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111',
   'Friday Roast — 1kg Ethiopian, half price', 'Roasted this morning. Pick up or courier.',
   31.00, 'NZD', 20, 14, now() + interval '2 days', 'active', 'local', 38),

  ('c2222222-0001-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222',
   'Vintage denim clearance — 40% off', 'End of season. Sizes S-XL while they last.',
   126.00, 'NZD', 12, 9, now() + interval '5 days', 'active', 'city', 210),

  ('c3333333-0001-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333',
   'Ex-demo tramping jackets', 'Used once for in-store fitting. As new.',
   299.00, 'NZD', 8, 2, now() + interval '18 hours', 'active', 'region', 540),

  ('c4444444-0001-4444-8444-444444444444', 'a4444444-4444-4444-8444-444444444444',
   'Refurb laptop bundle — 3 units left', 'Dell Latitude i7 with dock included.',
   999.00, 'NZD', 10, 3, now() + interval '4 days', 'active', 'national', 1180),

  ('c5555555-0001-4555-8555-555555555555', 'a5555555-5555-4555-8555-555555555555',
   'Studio seconds — ceramic mugs', 'Minor glaze imperfections. Fully usable.',
   28.00, 'NZD', 15, 15, now() + interval '9 days', 'active', 'local', 0),

  -- Terminal states, so status filtering has something to exclude.
  ('c6666666-0001-4666-8666-666666666666', 'a6666666-6666-4666-8666-666666666666',
   'Winter tyre clearance', 'Ended — kept to exercise the sold_out filter.',
   540.00, 'NZD', 6, 0, now() + interval '3 days', 'sold_out', 'city', 96),

  ('c6666666-0002-4666-8666-666666666666', 'a6666666-6666-4666-8666-666666666666',
   'Roof rack run-out', 'Ended — kept to exercise the expired filter.',
   340.00, 'NZD', 5, 2, now() - interval '2 days', 'expired', 'local', 44)
on conflict (id) do nothing;
