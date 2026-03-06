-- Drop legacy views that reference old columns
DROP VIEW IF EXISTS "companies_summary";
DROP VIEW IF EXISTS "contacts_summary";

-- Companies: drop unused columns, add domain + category
ALTER TABLE "companies" DROP COLUMN IF EXISTS "sector";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "size";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "linkedin_url";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "website";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "phone_number";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "address";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "zipcode";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "city";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "state_abbr";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "country";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "revenue";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "tax_identifier";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "logo";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "context_links";
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "domain" varchar(512);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "category" varchar(255);
DROP INDEX IF EXISTS "companies_sector_idx";

-- Contacts: drop unused columns
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "gender";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "title";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "email_jsonb";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "phone_jsonb";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "background";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "avatar";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "first_seen";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "last_seen";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "has_newsletter";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "status";
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "tags";
DROP INDEX IF EXISTS "contacts_status_idx";

-- Deals: drop unused columns, rename stage -> status
ALTER TABLE "deals" DROP COLUMN IF EXISTS "contact_ids";
ALTER TABLE "deals" DROP COLUMN IF EXISTS "category";
ALTER TABLE "deals" DROP COLUMN IF EXISTS "description";
ALTER TABLE "deals" DROP COLUMN IF EXISTS "expected_closing_date";
ALTER TABLE "deals" DROP COLUMN IF EXISTS "index";
ALTER TABLE "deals" RENAME COLUMN "stage" TO "status";
DROP INDEX IF EXISTS "deals_stage_idx";
DROP INDEX IF EXISTS "deals_category_idx";
CREATE INDEX IF NOT EXISTS "deals_status_idx" ON "deals" ("status");
