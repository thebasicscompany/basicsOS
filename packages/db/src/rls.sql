-- Row-Level Security policies for all tables
-- Applied after each migration via db:migrate script

-- Enable RLS on every tenant-scoped table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activity_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_employee_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_employee_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy template (repeated for each table)
-- The API middleware sets: SET LOCAL app.tenant_id = '<uuid>'
-- Every query is then automatically scoped to the current tenant.

CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON document_embeddings
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Meeting sub-tables use tenant_id directly (added in schema fix)
CREATE POLICY tenant_isolation ON meeting_participants
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON transcripts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON meeting_summaries
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON meeting_embeddings
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- deal_activities and embeddings isolated via FK chain (deals.tenant_id)
-- Access only through authenticated deal queries; direct queries require tenant context
CREATE POLICY tenant_isolation ON deal_activities
  USING (deal_id IN (
    SELECT id FROM deals WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

CREATE POLICY tenant_isolation ON deal_activity_embeddings
  USING (activity_id IN (
    SELECT da.id FROM deal_activities da
    JOIN deals d ON d.id = da.deal_id
    WHERE d.tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

-- automation_runs isolated via FK to automations
CREATE POLICY tenant_isolation ON automation_runs
  USING (automation_id IN (
    SELECT id FROM automations WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

-- ai_employee_outputs isolated via FK to ai_employee_jobs
CREATE POLICY tenant_isolation ON ai_employee_outputs
  USING (job_id IN (
    SELECT id FROM ai_employee_jobs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

-- sessions: not tenant-scoped; managed exclusively by auth layer (Better Auth).
-- No RLS policy needed — auth middleware validates session tokens directly.

CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON companies
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON deals
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON meetings
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON automations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON ai_employee_jobs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON hub_links
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON integrations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON notifications
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON files
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON invites
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
