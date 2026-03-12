ALTER TABLE "crm_users"
ADD COLUMN IF NOT EXISTS "onboarding_seen_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "crm_users"
ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp with time zone;
