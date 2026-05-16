create table products (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid not null references sellers(id) on delete cascade,
  external_id       text,
  name              text not null,
  description       text,
  price             numeric not null check (price >= 0),
  currency          text not null default 'NZD',
  category          text,
  images            jsonb not null default '[]',
  delivery_days_min integer,
  delivery_days_max integer,
  return_policy     text,
  stock_available   boolean not null default true,
  embedding         vector(1536),
  last_synced       timestamptz not null default now(),

  unique(seller_id, external_id)
);

comment on table products is
  'Cached product catalogue. Synced from seller APIs or CSV feeds. embedding enables semantic similarity search.';

create index products_seller_id_idx on products(seller_id);
create index products_category_idx on products(category) where category is not null;
create index products_stock_idx on products(stock_available) where stock_available = true;
create index products_name_trgm_idx on products using gin(name gin_trgm_ops);
create index products_embedding_idx on products
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
