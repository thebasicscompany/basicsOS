-- Custom Apps (F2): app_config mirrors object_config. One row = one app in every
-- user's sidebar at /apps/:slug. Publishing an app is a write here — never a
-- signed-client rebuild. organization_id is nullable (NULL = global default app).
-- See docs/CONTRACTS_MCP_BROKER_AND_APP_SDK.md B.6 / PLATFORM §9.4.

CREATE TABLE IF NOT EXISTS "app_config" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "slug" varchar(64) NOT NULL,
  "name" varchar(128) NOT NULL,
  "icon" varchar(64) DEFAULT 'layout-grid' NOT NULL,
  "icon_color" varchar(32) DEFAULT 'blue' NOT NULL,
  "type" varchar(32) DEFAULT 'declarative' NOT NULL,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "spec" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "backend_module" jsonb,
  "version" varchar(32) DEFAULT '1.0.0' NOT NULL,
  "position" smallint DEFAULT 0 NOT NULL,
  "created_by_crm_user_id" bigint,
  "organization_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "app_config_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "app_config"
  ADD CONSTRAINT "app_config_created_by_crm_user_id_crm_users_id_fk"
  FOREIGN KEY ("created_by_crm_user_id") REFERENCES "crm_users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "app_config"
  ADD CONSTRAINT "app_config_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_config_org_idx" ON "app_config" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_config_status_idx" ON "app_config" ("status");
