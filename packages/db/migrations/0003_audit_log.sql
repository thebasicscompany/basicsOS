CREATE TABLE crm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity text NOT NULL,
  record_id uuid NOT NULL,
  user_id text NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_record ON crm_audit_log(entity, record_id, changed_at DESC);
