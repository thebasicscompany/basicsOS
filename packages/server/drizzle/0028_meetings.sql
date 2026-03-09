-- Meeting recording tables
CREATE TABLE IF NOT EXISTS meetings (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  crm_user_id BIGINT REFERENCES crm_users(id) ON DELETE CASCADE,
  title VARCHAR(512),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration INTEGER,
  status VARCHAR(32) NOT NULL DEFAULT 'recording',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meetings_org_idx ON meetings(organization_id);
CREATE INDEX IF NOT EXISTS meetings_crm_user_id_idx ON meetings(crm_user_id);
CREATE INDEX IF NOT EXISTS meetings_status_idx ON meetings(status);

CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id BIGSERIAL PRIMARY KEY,
  meeting_id BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  speaker VARCHAR(128),
  text TEXT,
  timestamp_ms INTEGER,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS meeting_transcripts_meeting_id_idx ON meeting_transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS meeting_transcripts_org_idx ON meeting_transcripts(organization_id);

CREATE TABLE IF NOT EXISTS meeting_summaries (
  id BIGSERIAL PRIMARY KEY,
  meeting_id BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  summary_json JSONB,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id)
);

CREATE INDEX IF NOT EXISTS meeting_summaries_org_idx ON meeting_summaries(organization_id);
