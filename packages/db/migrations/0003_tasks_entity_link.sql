ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_entity_type text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_entity_id uuid;
CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks(related_entity_type, related_entity_id) WHERE related_entity_type IS NOT NULL;
