// Org-scoped read access for the MCP Broker's native (object) + memory tools.
//
// Reads are ORG-scoped only: basicsOS is org-wide (no per-record visibility ACL),
// so the agent reading all of the org's CRM is correct product behavior. Per-user
// concerns (writes, connections, automations) are layered on later (M4+).

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import * as schema from "@/db/schema/index.js";
import { embedQuery } from "@/lib/context.js";

const SEARCH_LIMIT = 25;

/** The single company/org this hermes instance serves. */
export async function resolveSingleOrgId(db: Db): Promise<string> {
  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .orderBy(schema.organizations.createdAt)
    .limit(1);
  if (!org) throw new Error("No organization row found in this company's database");
  return org.id;
}

const dealColumns = {
  id: schema.deals.id,
  name: schema.deals.name,
  status: schema.deals.status,
  amount: schema.deals.amount,
  companyId: schema.deals.companyId,
  company: schema.companies.name,
  crmUserId: schema.deals.crmUserId,
};

/** Search deals by deal name OR associated company name (org-scoped). */
export async function searchDeals(db: Db, orgId: string, query: string) {
  const q = (query ?? "").trim();
  const like = `%${q}%`;
  return db
    .select(dealColumns)
    .from(schema.deals)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.deals.companyId))
    .where(
      and(
        eq(schema.deals.organizationId, orgId),
        q ? or(ilike(schema.deals.name, like), ilike(schema.companies.name, like)) : undefined,
      ),
    )
    .orderBy(desc(schema.deals.updatedAt))
    .limit(SEARCH_LIMIT);
}

export async function getDeal(db: Db, orgId: string, id: number) {
  const [row] = await db
    .select(dealColumns)
    .from(schema.deals)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.deals.companyId))
    .where(and(eq(schema.deals.organizationId, orgId), eq(schema.deals.id, id)))
    .limit(1);
  return row ?? null;
}

const contactColumns = {
  id: schema.contacts.id,
  firstName: schema.contacts.firstName,
  lastName: schema.contacts.lastName,
  email: schema.contacts.email,
  companyId: schema.contacts.companyId,
  company: schema.companies.name,
  crmUserId: schema.contacts.crmUserId,
};

/** Search contacts by name / email / associated company name (org-scoped). */
export async function searchContacts(db: Db, orgId: string, query: string) {
  const q = (query ?? "").trim();
  const like = `%${q}%`;
  return db
    .select(contactColumns)
    .from(schema.contacts)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.contacts.companyId))
    .where(
      and(
        eq(schema.contacts.organizationId, orgId),
        q
          ? or(
              ilike(schema.contacts.firstName, like),
              ilike(schema.contacts.lastName, like),
              ilike(schema.contacts.email, like),
              ilike(schema.companies.name, like),
            )
          : undefined,
      ),
    )
    .orderBy(desc(schema.contacts.createdAt))
    .limit(SEARCH_LIMIT);
}

export async function getContact(db: Db, orgId: string, id: number) {
  const [row] = await db
    .select(contactColumns)
    .from(schema.contacts)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.contacts.companyId))
    .where(and(eq(schema.contacts.organizationId, orgId), eq(schema.contacts.id, id)))
    .limit(1);
  return row ?? null;
}

export interface RecalledChunk {
  text: string;
  entityType: string;
  entityId: number;
  score: number;
}

/**
 * memory.recall_context — embed the query through the gateway (same alias +
 * dimension as the write path) and pgvector-search the org's context_embeddings.
 * Org-scoped, returns structured chunks with a cosine similarity score.
 */
export async function recallContext(
  db: Db,
  env: Env,
  orgId: string,
  query: string,
  k = 5,
): Promise<{ chunks: RecalledChunk[] }> {
  const gatewayHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.SERVER_BASICS_API_KEY ?? ""}`,
  };
  const { embedding } = await embedQuery(env.BASICSOS_API_URL, gatewayHeaders, query);
  // embedding is typed number[] but comes from an external gateway response —
  // reject anything non-finite before building the vector literal so a malformed
  // response can't produce an invalid `::vector` cast.
  if (!embedding || embedding.length === 0 || !embedding.every((v) => Number.isFinite(v))) {
    return { chunks: [] };
  }

  const vec = `[${embedding.join(",")}]`;
  const rows = await db.execute(sql`
    select entity_type, entity_id, chunk_text,
           1 - (embedding <=> ${vec}::vector) as score
    from context_embeddings
    where organization_id = ${orgId} and embedding is not null
    order by embedding <=> ${vec}::vector
    limit ${k}
  `);
  // drizzle/postgres-js returns the rows array directly; mirror the codebase's
  // established shape guard (lib/context.ts).
  const list = Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? []);
  return {
    chunks: (list as Array<Record<string, unknown>>).map((r) => ({
      text: String(r.chunk_text ?? ""),
      entityType: String(r.entity_type ?? ""),
      entityId: Number(r.entity_id ?? 0),
      score: Number(r.score ?? 0),
    })),
  };
}
