CREATE TABLE IF NOT EXISTS "org_ai_config" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "organization_id" uuid NOT NULL,
  "key_type" varchar(20) NOT NULL DEFAULT 'basicsos',
  "byok_provider" varchar(20),
  "api_key_enc" text,
  "api_key_hash" varchar(64),
  "configured_by" bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "org_ai_config" ADD CONSTRAINT "org_ai_config_organization_id_unique" UNIQUE ("organization_id");
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org_ai_config" ADD CONSTRAINT "org_ai_config_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "org_ai_config" ADD CONSTRAINT "org_ai_config_configured_by_crm_users_id_fk"
 FOREIGN KEY ("configured_by") REFERENCES "public"."crm_users"("id")
 ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "organization_id" uuid NOT NULL,
  "crm_user_id" bigint NOT NULL,
  "feature" varchar(30) NOT NULL,
  "model" varchar(100),
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "duration_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_crm_user_id_crm_users_id_fk"
 FOREIGN KEY ("crm_user_id") REFERENCES "public"."crm_users"("id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ai_usage_logs_org_created_idx" ON "ai_usage_logs" ("organization_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_logs_user_created_idx" ON "ai_usage_logs" ("crm_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_logs_feature_idx" ON "ai_usage_logs" ("feature");
