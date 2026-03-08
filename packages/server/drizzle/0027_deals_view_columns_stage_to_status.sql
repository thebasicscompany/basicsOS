-- Fix deals grid: column was renamed stage->status in 0023; view_columns/sorts/filters still had fieldId 'stage'.
-- Update view_columns, view_sorts, and view_filters for deals views so status shows in grid.

UPDATE view_columns vc
SET field_id = 'status'
FROM views v
WHERE vc.view_id = v.id
  AND v.object_slug = 'deals'
  AND vc.field_id = 'stage';

UPDATE view_sorts vs
SET field_id = 'status'
FROM views v
WHERE vs.view_id = v.id
  AND v.object_slug = 'deals'
  AND vs.field_id = 'stage';

UPDATE view_filters vf
SET field_id = 'status'
FROM views v
WHERE vf.view_id = v.id
  AND v.object_slug = 'deals'
  AND vf.field_id = 'stage';
