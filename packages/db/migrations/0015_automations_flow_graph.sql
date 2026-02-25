-- Persist visual workflow graph for automations (React Flow nodes/edges).
-- trigger_config and action_chain remain the execution source of truth; when flow is saved we derive them from the graph.
ALTER TABLE automations ADD COLUMN IF NOT EXISTS flow_nodes jsonb;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS flow_edges jsonb;
