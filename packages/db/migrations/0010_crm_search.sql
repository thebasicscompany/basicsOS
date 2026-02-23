ALTER TABLE contacts ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(email,''))) STORED;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(domain,''))) STORED;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,''))) STORED;
CREATE INDEX IF NOT EXISTS idx_contacts_fts ON contacts USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_companies_fts ON companies USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_deals_fts ON deals USING GIN(search_vector);
