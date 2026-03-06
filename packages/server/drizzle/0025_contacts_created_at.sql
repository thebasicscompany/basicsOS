-- Add created_at to contacts (for sorting/display in activity feed)
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
