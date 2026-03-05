ALTER TABLE "org_ai_config" ADD COLUMN IF NOT EXISTS "transcription_byok_provider" varchar(20);
--> statement-breakpoint
ALTER TABLE "org_ai_config" ADD COLUMN IF NOT EXISTS "transcription_api_key_enc" text;
