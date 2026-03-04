ALTER TABLE "crm_users"
ADD COLUMN IF NOT EXISTS "basics_api_key_enc" text;
--> statement-breakpoint

ALTER TABLE "crm_users"
ADD COLUMN IF NOT EXISTS "basics_api_key_hash" varchar(64);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "crm_users_basics_api_key_hash_idx"
ON "crm_users" ("basics_api_key_hash");
