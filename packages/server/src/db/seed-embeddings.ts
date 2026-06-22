// Dev utility: embed the seeded CRM records into context_embeddings so the
// agent's memory.recall_context tool has something to retrieve. `db:seed`
// creates raw CRM rows but does NOT embed them (embedding normally happens on
// the API write path). Run AFTER `db:seed`:
//
//   pnpm --filter @basics-os/server db:seed-embeddings
//
// Requires BASICSOS_API_URL (gateway) + SERVER_BASICS_API_KEY in env so the
// gateway /v1/embeddings (basics-embed) can produce vectors.

import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client.js";
import { getEnv } from "@/env.js";
import * as schema from "@/db/schema/index.js";
import { upsertEntityEmbedding } from "@/lib/embeddings.js";

async function main() {
  const env = getEnv();
  const apiKey = env.SERVER_BASICS_API_KEY;
  if (!apiKey) throw new Error("SERVER_BASICS_API_KEY is required to embed (gateway /v1/embeddings).");
  const gatewayUrl = env.BASICSOS_API_URL;
  const { db, close } = createDb(env.DATABASE_URL);

  let n = 0;
  const embed = async (crmUserId: number | null, type: string, id: number, text: string) => {
    if (!crmUserId) return;
    await upsertEntityEmbedding(db, gatewayUrl, apiKey, crmUserId, type, id, text);
    n += 1;
    process.stdout.write(`  embedded ${type}#${id}\n`);
  };

  const companies = await db.select().from(schema.companies);
  for (const c of companies) {
    const parts = [`Company: ${c.name}.`];
    if (c.category) parts.push(`Category: ${c.category}.`);
    if (c.description) parts.push(c.description);
    await embed(c.crmUserId, "company", c.id, parts.join(" "));
  }

  const deals = await db
    .select({
      id: schema.deals.id,
      name: schema.deals.name,
      status: schema.deals.status,
      amount: schema.deals.amount,
      crmUserId: schema.deals.crmUserId,
      company: schema.companies.name,
    })
    .from(schema.deals)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.deals.companyId));
  for (const d of deals) {
    const parts = [`Deal: ${d.name}.`, `Status: ${d.status}.`];
    if (d.amount != null) parts.push(`Value: $${d.amount}.`);
    if (d.company) parts.push(`Company: ${d.company}.`);
    await embed(d.crmUserId, "deal", d.id, parts.join(" "));
  }

  const contacts = await db
    .select({
      id: schema.contacts.id,
      firstName: schema.contacts.firstName,
      lastName: schema.contacts.lastName,
      email: schema.contacts.email,
      crmUserId: schema.contacts.crmUserId,
      company: schema.companies.name,
    })
    .from(schema.contacts)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.contacts.companyId));
  for (const ct of contacts) {
    const name = [ct.firstName, ct.lastName].filter(Boolean).join(" ");
    const parts = [`Contact: ${name}.`];
    if (ct.email) parts.push(`Email: ${ct.email}.`);
    if (ct.company) parts.push(`Company: ${ct.company}.`);
    await embed(ct.crmUserId, "contact", ct.id, parts.join(" "));
  }

  await close();
  process.stdout.write(`Done — embedded ${n} records.\n`);
}

main().catch((err) => {
  console.error("seed-embeddings failed:", err);
  process.exit(1);
});
