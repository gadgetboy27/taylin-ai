-- Structured location on both sides of the marketplace, so "local" can be
-- matched exactly rather than inferred.
--
-- Two problems this closes:
--
-- 1. No country column existed anywhere. Postcodes are only unique within a
--    country — NZ 0200 (Paihia) and an overseas 0200 are indistinguishable —
--    so any postcode match risked pairing a Northland buyer with a foreign
--    seller. Defaulted to NZ because that is the only market today, and
--    backfilling existing rows to NZ is correct rather than merely convenient.
--
-- 2. City was free text and arrived from the interview as prose. The first
--    real seller stored
--      'Paihia, Te Tokerou (Te Tai Tokerau), Northland; serves North Island'
--    which no buyer will ever type, so lib/broadcast.ts (exact city equality)
--    could never match them. Suburb + city + postcode as separate fields gives
--    the search ladder something deterministic to join on.
--
-- Left nullable at the database level: existing users and sellers predate the
-- columns and there is no honest value to invent for them. The API requires
-- them on write (routes/profile.ts) so anything captured from now on is
-- complete, and search simply can't place a row that lacks them.
alter table users
  add column country text not null default 'NZ',
  add column suburb text;

alter table sellers
  add column country text not null default 'NZ',
  add column suburb text;

comment on column users.country is
  'ISO-ish country code, NZ today. Postcodes are only unique within a country, so every locality comparison must include this.';
comment on column sellers.suburb is
  'Suburb/locality — the tightest rung of the search ladder in routes/search.ts, above postcode and city.';

-- The search ladder filters sellers by country → postcode → city, so index the
-- combinations it actually queries rather than each column separately.
create index sellers_country_postcode_idx on sellers(country, postcode)
  where postcode is not null;
create index sellers_country_city_idx on sellers(country, city)
  where city is not null;
create index users_country_postcode_idx on users(country, postcode)
  where postcode is not null;

-- The one real seller on file has usable postcode/suburb buried in that prose
-- city string. Normalise it so it can actually be matched, rather than leaving
-- a row that silently never joins.
update sellers
   set suburb = 'Paihia',
       city   = 'Paihia'
 where postcode = '0200'
   and city like 'Paihia,%';
