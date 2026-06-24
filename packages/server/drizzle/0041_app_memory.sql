-- App-contributed company knowledge (F2 keystone). `context.remember` writes a row
-- here AND embeds the text into context_embeddings (entity_type "app_memory"), so
-- the agent's memory.recall_context surfaces anything a company's apps record.

CREATE TABLE IF NOT EXISTS "app_memory" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "organization_id" uuid NOT NULL,
  "crm_user_id" bigint NOT NULL,
  "app_slug" varchar(64) NOT NULL,
  "title" varchar(256),
  "text" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_memory"
  ADD CONSTRAINT "app_memory_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "app_memory"
  ADD CONSTRAINT "app_memory_crm_user_id_crm_users_id_fk"
  FOREIGN KEY ("crm_user_id") REFERENCES "crm_users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_memory_org_created_idx" ON "app_memory" ("organization_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_memory_org_app_idx" ON "app_memory" ("organization_id", "app_slug");
