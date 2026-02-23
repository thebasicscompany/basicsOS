CREATE TABLE crm_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  entity text NOT NULL,
  record_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, entity, record_id)
);
CREATE INDEX idx_crm_favorites_user ON crm_favorites(tenant_id, user_id);
