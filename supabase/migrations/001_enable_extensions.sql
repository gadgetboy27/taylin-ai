-- Enable pgvector for semantic preference embeddings
create extension if not exists vector;

-- Enable pg_trgm for fast fuzzy text search on product names
create extension if not exists pg_trgm;
