-- Manual address/postcode capture — no lat/lng, no geocoding service. A
-- postcode/city pair is enough to compute a coarse "local -> city -> region
-- -> national -> international" broadcast tier (see lib/broadcast.ts), and
-- avoids the mobile permission-prompt UX and privacy surface of device GPS.

alter table users
  add column address_text text,
  add column postcode text,
  add column city text;

alter table sellers
  add column address_text text,
  add column postcode text,
  add column city text;

create index users_postcode_idx on users(postcode) where postcode is not null;
create index sellers_postcode_idx on sellers(postcode) where postcode is not null;

comment on column users.postcode is
  'Buyer-supplied postcode, set via POST /profile/address. Used only for local-first deal broadcast targeting (lib/broadcast.ts) — never for anything precision-sensitive.';
comment on column sellers.postcode is
  'Seller postcode, collected during the Taylor interview alongside business_name/website. Anchors the local tier in deal broadcast expansion.';
