CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "crm_user_id" bigint,
  "organization_id" uuid,
  "action" varchar(128) NOT NULL,
  "entity_type" varchar(128),
  "entity_id" varchar(128),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_crm_user_id_crm_users_id_fk"
 FOREIGN KEY ("crm_user_id") REFERENCES "public"."crm_users"("id")
 ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_org_created_idx" ON "audit_logs" ("organization_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_created_idx" ON "audit_logs" ("crm_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
