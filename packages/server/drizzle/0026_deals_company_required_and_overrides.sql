-- Fix deals status override: column was renamed stage->status in 0023
-- Add company_id overrides so deals/contacts use company selector (not raw ID input)
-- Company override enables selecting from companies list instead of entering ID

-- 1) Fix deals status override: remove obsolete 'stage' override, add 'status' with options
DELETE FROM object_attribute_overrides
WHERE object_config_id = (SELECT id FROM object_config WHERE slug = 'deals')
  AND column_name = 'stage';

INSERT INTO object_attribute_overrides (object_config_id, column_name, display_name, ui_type, is_primary, config)
SELECT
  (SELECT id FROM object_config WHERE slug = 'deals' LIMIT 1),
  'status',
  'Status',
  'status',
  false,
  '{"options":[{"id":"opportunity","label":"Opportunity","color":"blue","order":0},{"id":"proposal-made","label":"Proposal Made","color":"cyan","order":1},{"id":"in-negotiation","label":"In Negotiation","color":"orange","order":2},{"id":"won","label":"Won","color":"green","order":3,"isTerminal":true},{"id":"lost","label":"Lost","color":"red","order":4,"isTerminal":true},{"id":"delayed","label":"Delayed","color":"gray","order":5}]}'::jsonb
ON CONFLICT (object_config_id, column_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  ui_type = EXCLUDED.ui_type,
  config = EXCLUDED.config;

-- 2) Add company_id override for contacts (company selector)
INSERT INTO object_attribute_overrides (object_config_id, column_name, display_name, ui_type, is_primary, config)
SELECT
  (SELECT id FROM object_config WHERE slug = 'contacts' LIMIT 1),
  'company_id',
  'Company',
  'company',
  false,
  '{}'::jsonb
ON CONFLICT (object_config_id, column_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  ui_type = EXCLUDED.ui_type;

-- 3) Add company_id override for deals (company selector, required)
INSERT INTO object_attribute_overrides (object_config_id, column_name, display_name, ui_type, is_primary, config)
SELECT
  (SELECT id FROM object_config WHERE slug = 'deals' LIMIT 1),
  'company_id',
  'Company',
  'company',
  false,
  '{"required":true}'::jsonb
ON CONFLICT (object_config_id, column_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  ui_type = EXCLUDED.ui_type,
  config = EXCLUDED.config;
