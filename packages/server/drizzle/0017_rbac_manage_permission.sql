INSERT INTO "rbac_permissions" ("key", "description")
VALUES ('rbac.manage', 'Manage RBAC roles and assignments')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

WITH admin_role AS (
  SELECT id FROM rbac_roles WHERE key = 'org_admin' LIMIT 1
),
manage_perm AS (
  SELECT id FROM rbac_permissions WHERE key = 'rbac.manage' LIMIT 1
)
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT a.id, p.id
FROM admin_role a
CROSS JOIN manage_perm p
ON CONFLICT (role_id, permission_id) DO NOTHING;
