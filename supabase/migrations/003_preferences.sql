create table preferences (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  category         text not null,
  embedding        vector(1536),
  positive_signals jsonb not null default '[]',
  negative_signals jsonb not null default '[]',
  last_updated     timestamptz not null default now(),

  unique(user_id, category)
);

comment on table preferences is
  'Per-category preference graph. Embedding is a pgvector of positive signals. Updated after every purchase/skip/return.';

create index preferences_user_id_idx on preferences(user_id);
create index preferences_embedding_idx on preferences
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
