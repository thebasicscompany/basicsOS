-- Allow deleting a company by setting deals.company_id to NULL when company is deleted
ALTER TABLE "deals" DROP CONSTRAINT IF EXISTS "deals_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE no action;
