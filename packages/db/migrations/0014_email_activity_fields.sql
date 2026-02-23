ALTER TABLE deal_activities ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE deal_activities ADD COLUMN IF NOT EXISTS direction text; -- 'inbound' | 'outbound'
ALTER TABLE deal_activities ADD COLUMN IF NOT EXISTS activity_date timestamptz;
