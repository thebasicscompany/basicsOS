CREATE TABLE custom_field_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity text NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  type text NOT NULL,
  options jsonb,
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entity, key)
);

CREATE INDEX custom_field_defs_tenant_entity_idx ON custom_field_defs(tenant_id, entity);
