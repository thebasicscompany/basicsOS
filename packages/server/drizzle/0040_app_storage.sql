-- App SDK bridge storage (F2, APP-4b). Per-app key/value, scoped by (org, app,
-- scope) and by user for scope "user". Hosted apps run at an opaque origin (no
-- browser storage), so this server-backed store is their state — the host sets the
-- scope, so apps can't read another app's or another user's data.

CREATE TABLE IF NOT EXISTS "app_storage" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "organization_id" uuid NOT NULL,
  "app_slug" varchar(64) NOT NULL,
  "scope" varchar(16) NOT NULL,
  "crm_user_id" bigint,
  "key" varchar(256) NOT NULL,
  "value" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_storage"
  ADD CONSTRAINT "app_storage_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_storage_lookup_idx"
  ON "app_storage" ("organization_id", "app_slug", "scope", "crm_user_id", "key");
