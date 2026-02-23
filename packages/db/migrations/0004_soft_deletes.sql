ALTER TABLE contacts ADD COLUMN deleted_at timestamptz;
ALTER TABLE companies ADD COLUMN deleted_at timestamptz;
ALTER TABLE deals ADD COLUMN deleted_at timestamptz;
CREATE INDEX idx_contacts_deleted ON contacts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_deleted ON companies(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_deleted ON deals(deleted_at) WHERE deleted_at IS NULL;
