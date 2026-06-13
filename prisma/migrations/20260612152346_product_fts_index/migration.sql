-- GIN expression index backing the Portuguese full-text product search
-- (see searchProductIds in src/lib/catalog.ts).
CREATE INDEX IF NOT EXISTS "Product_fts_idx" ON "Product" USING GIN (
  to_tsvector(
    'portuguese',
    coalesce("name", '') || ' ' ||
    coalesce("modelCode", '') || ' ' ||
    coalesce("shortDescription", '') || ' ' ||
    coalesce("description", '')
  )
);
