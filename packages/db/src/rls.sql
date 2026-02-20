-- Row-Level Security policies for all tables.
-- Idempotent: safe to run after every migration.
-- Applied automatically by `bun db:migrate` via apply-rls.ts.

-- ─── Enable RLS (idempotent — no-op if already enabled) ──────────────────────
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

-- ─── Tenant isolation policies ────────────────────────────────────────────────
-- The tRPC context sets: SET LOCAL app.tenant_id = '<uuid>' per request.
-- Every query is then automatically scoped to the current tenant.
-- DROP POLICY IF EXISTS makes each block safe to re-run after migrations.

DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON documents;
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON document_embeddings;
CREATE POLICY tenant_isolation ON document_embeddings
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON meeting_participants;
CREATE POLICY tenant_isolation ON meeting_participants
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON transcripts;
CREATE POLICY tenant_isolation ON transcripts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON meeting_summaries;
CREATE POLICY tenant_isolation ON meeting_summaries
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON meeting_embeddings;
CREATE POLICY tenant_isolation ON meeting_embeddings
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- deal_activities isolated via FK to deals
DROP POLICY IF EXISTS tenant_isolation ON deal_activities;
CREATE POLICY tenant_isolation ON deal_activities
  USING (deal_id IN (
    SELECT id FROM deals WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

-- deal_activity_embeddings isolated via FK chain through deals
DROP POLICY IF EXISTS tenant_isolation ON deal_activity_embeddings;
CREATE POLICY tenant_isolation ON deal_activity_embeddings
  USING (activity_id IN (
    SELECT da.id FROM deal_activities da
    JOIN deals d ON d.id = da.deal_id
    WHERE d.tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

-- automation_runs isolated via FK to automations
DROP POLICY IF EXISTS tenant_isolation ON automation_runs;
CREATE POLICY tenant_isolation ON automation_runs
  USING (automation_id IN (
    SELECT id FROM automations WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

-- ai_employee_outputs isolated via FK to ai_employee_jobs
DROP POLICY IF EXISTS tenant_isolation ON ai_employee_outputs;
CREATE POLICY tenant_isolation ON ai_employee_outputs
  USING (job_id IN (
    SELECT id FROM ai_employee_jobs WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
  ));

-- sessions: not tenant-scoped; managed by Better Auth. No RLS policy needed.

DROP POLICY IF EXISTS tenant_isolation ON contacts;
CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON companies;
CREATE POLICY tenant_isolation ON companies
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON deals;
CREATE POLICY tenant_isolation ON deals
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON meetings;
CREATE POLICY tenant_isolation ON meetings
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON tasks;
CREATE POLICY tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON automations;
CREATE POLICY tenant_isolation ON automations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON ai_employee_jobs;
CREATE POLICY tenant_isolation ON ai_employee_jobs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON hub_links;
CREATE POLICY tenant_isolation ON hub_links
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON integrations;
CREATE POLICY tenant_isolation ON integrations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON events;
CREATE POLICY tenant_isolation ON events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON notifications;
CREATE POLICY tenant_isolation ON notifications
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON files;
CREATE POLICY tenant_isolation ON files
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON audit_log;
CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON invites;
CREATE POLICY tenant_isolation ON invites
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ─── pgvector HNSW indexes for semantic search ───────────────────────────────
-- HNSW is preferred over IVFFlat: no training step, better recall at scale.
-- vector_cosine_ops matches the cosine similarity used in the search router.
-- CONCURRENTLY cannot run inside a transaction block — apply-rls.ts executes
-- each of these statements in a separate client.query() call.
CREATE INDEX CONCURRENTLY IF NOT EXISTS document_embeddings_embedding_idx
  ON document_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS meeting_embeddings_embedding_idx
  ON meeting_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS deal_activity_embeddings_embedding_idx
  ON deal_activity_embeddings USING hnsw (embedding vector_cosine_ops);
