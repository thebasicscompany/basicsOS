CREATE TABLE crm_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity text NOT NULL,
  record_id uuid NOT NULL,
  filename text NOT NULL,
  storage_key text NOT NULL,
  size_bytes integer NOT NULL,
  mime_type text NOT NULL,
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_attachments_record ON crm_attachments(tenant_id, entity, record_id);
