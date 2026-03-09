-- Email sync state (one row per org)
CREATE TABLE IF NOT EXISTS email_sync_state (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  crm_user_id BIGINT REFERENCES crm_users(id) ON DELETE CASCADE,
  history_id TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_status VARCHAR(32) NOT NULL DEFAULT 'idle',
  total_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  settings JSONB NOT NULL DEFAULT '{"syncPeriodDays":90,"enrichWithAi":true,"autoAcceptThreshold":null}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_sync_state_org_idx ON email_sync_state(organization_id);

-- Synced email metadata
CREATE TABLE IF NOT EXISTS synced_emails (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gmail_message_id VARCHAR(64) NOT NULL,
  gmail_thread_id VARCHAR(64),
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  from_email VARCHAR(512) NOT NULL,
  from_name VARCHAR(512),
  to_addresses JSONB NOT NULL DEFAULT '[]',
  cc_addresses JSONB NOT NULL DEFAULT '[]',
  date TIMESTAMPTZ NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS synced_emails_org_msg_idx ON synced_emails(organization_id, gmail_message_id);
CREATE INDEX IF NOT EXISTS synced_emails_org_date_idx ON synced_emails(organization_id, date);
CREATE INDEX IF NOT EXISTS synced_emails_org_from_idx ON synced_emails(organization_id, from_email);

-- Suggested contacts (AI-scored staging area)
CREATE TABLE IF NOT EXISTS suggested_contacts (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(512) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  domain VARCHAR(255),
  company_name VARCHAR(255),
  score SMALLINT NOT NULL DEFAULT 0,
  signals JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  email_count INTEGER NOT NULL DEFAULT 0,
  last_email_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS suggested_contacts_org_email_idx ON suggested_contacts(organization_id, email);
CREATE INDEX IF NOT EXISTS suggested_contacts_org_status_score_idx ON suggested_contacts(organization_id, status, score);
CREATE INDEX IF NOT EXISTS suggested_contacts_org_status_idx ON suggested_contacts(organization_id, status);

-- Email-to-contact links (many-to-many)
CREATE TABLE IF NOT EXISTS email_contact_links (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  synced_email_id BIGINT NOT NULL REFERENCES synced_emails(id) ON DELETE CASCADE,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role VARCHAR(8) NOT NULL DEFAULT 'from'
);

CREATE UNIQUE INDEX IF NOT EXISTS email_contact_links_unique_idx ON email_contact_links(synced_email_id, contact_id, role);
CREATE INDEX IF NOT EXISTS email_contact_links_contact_idx ON email_contact_links(contact_id);
CREATE INDEX IF NOT EXISTS email_contact_links_email_idx ON email_contact_links(synced_email_id);

-- Indexes on existing tables for email lookup
CREATE INDEX IF NOT EXISTS contacts_email_org_idx ON contacts(organization_id, email);
