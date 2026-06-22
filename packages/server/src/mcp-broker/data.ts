// Org-scoped read access for the MCP Broker's native (object) + memory tools.
//
// Reads are ORG-scoped only: basicsOS is org-wide (no per-record visibility ACL),
// so the agent reading all of the org's CRM is correct product behavior. Per-user
// concerns (writes, connections, automations) are layered on later (M4+).

import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import * as schema from "@/db/schema/index.js";
import { embedQuery } from "@/lib/context.js";
import { insertRecord } from "@/data-access/crm/create.js";
import { updateRecord } from "@/data-access/crm/update.js";
import { hardDeleteRecord } from "@/data-access/crm/delete.js";
import { listRecords } from "@/data-access/crm/list.js";
import { getOneRecord } from "@/data-access/crm/get-one.js";

/** CRM resources the write tools support (generic data-access handles all of these). */
export type WritableResource =
  | "contacts"
  | "companies"
  | "deals"
  | "tasks"
  | "contact_notes"
  | "deal_notes"
  | "company_notes";

/** Generic org-scoped text search over any standard resource (delegates to listRecords). */
export async function searchResource(db: Db, orgId: string, resource: WritableResource, query: string) {
  const res = await listRecords(db, {
    resource,
    orgId,
    start: 0,
    end: 25,
    sorts: [],
    filter: query?.trim() ? { q: query.trim() } : {},
    genericFilters: [],
  });
  return res.rows;
}

/** Generic org-scoped get-by-id over any standard resource. */
export function getResource(db: Db, orgId: string, resource: WritableResource, id: number) {
  return getOneRecord(db, { resource, id, orgId });
}

/** Mark a task done (or not). */
export function setTaskDone(db: Db, orgId: string, id: number, done: boolean) {
  return updateRecord(db, { resource: "tasks", id, body: { doneDate: done ? new Date() : null }, orgId });
}

// ── Meetings (read-only: transcript + summary; the current chat can only LINK) ──
export async function listMeetings(db: Db, orgId: string, limit = 20) {
  return db
    .select({
      id: schema.meetings.id,
      title: schema.meetings.title,
      startedAt: schema.meetings.startedAt,
      status: schema.meetings.status,
    })
    .from(schema.meetings)
    .where(eq(schema.meetings.organizationId, orgId))
    .orderBy(desc(schema.meetings.startedAt))
    .limit(limit);
}

export async function getMeetingTranscript(db: Db, orgId: string, meetingId: number) {
  const rows = await db
    .select({ speaker: schema.meetingTranscripts.speaker, text: schema.meetingTranscripts.text })
    .from(schema.meetingTranscripts)
    .where(
      and(
        eq(schema.meetingTranscripts.meetingId, meetingId),
        eq(schema.meetingTranscripts.organizationId, orgId),
      ),
    )
    .orderBy(asc(schema.meetingTranscripts.timestampMs));
  return rows;
}

export async function getMeetingSummary(db: Db, orgId: string, meetingId: number) {
  const [row] = await db
    .select({ summary: schema.meetingSummaries.summaryJson })
    .from(schema.meetingSummaries)
    .where(
      and(
        eq(schema.meetingSummaries.meetingId, meetingId),
        eq(schema.meetingSummaries.organizationId, orgId),
      ),
    )
    .limit(1);
  return row?.summary ?? null;
}

// ── Custom field defs (object_config.write) ──
export async function createCustomField(
  db: Db,
  orgId: string,
  resource: string,
  name: string,
  label: string,
  fieldType: string,
  options?: unknown[],
) {
  const [row] = await db
    .insert(schema.customFieldDefs)
    .values({ resource, name, label, fieldType, options: options as never, organizationId: orgId })
    .returning();
  return row ?? null;
}

export async function deleteCustomField(db: Db, orgId: string, id: number) {
  const [row] = await db
    .delete(schema.customFieldDefs)
    .where(and(eq(schema.customFieldDefs.id, id), eq(schema.customFieldDefs.organizationId, orgId)))
    .returning();
  return row ?? null;
}

/** Create a record, stamping the acting user (crmUserId) + org. */
export function createRecord(
  db: Db,
  orgId: string,
  crmUserId: number,
  resource: WritableResource,
  body: Record<string, unknown>,
) {
  return insertRecord(db, { resource, body, crmUserId, orgId });
}

/** Update a record (org-scoped). */
export function updateRecordById(
  db: Db,
  orgId: string,
  resource: WritableResource,
  id: number,
  body: Record<string, unknown>,
) {
  return updateRecord(db, { resource, id, body, orgId });
}

/** Hard-delete a record (org-scoped). */
export function deleteRecordById(
  db: Db,
  orgId: string,
  resource: WritableResource,
  id: number,
) {
  return hardDeleteRecord(db, { resource, id, orgId });
}

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

/** Search deals by deal name OR associated company name, optional status (org-scoped). */
export async function searchDeals(db: Db, orgId: string, query: string, status?: string) {
  const q = (query ?? "").trim();
  const like = `%${q}%`;
  const st = (status ?? "").trim();
  return db
    .select(dealColumns)
    .from(schema.deals)
    .leftJoin(schema.companies, eq(schema.companies.id, schema.deals.companyId))
    .where(
      and(
        eq(schema.deals.organizationId, orgId),
        q ? or(ilike(schema.deals.name, like), ilike(schema.companies.name, like)) : undefined,
        st ? eq(schema.deals.status, st) : undefined,
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

// ── Custom objects (dynamic grids: each has its own custom_<slug> table) ──────
// These power the Broker's dynamically-generated object.{slug}.* tools, so a
// company's custom grids are agent-usable with zero code changes (contract A.4.1).

export interface CustomObjectInfo {
  slug: string;
  singular: string;
  plural: string;
  tableName: string;
}

/** Enumerate this org's active CUSTOM objects (those backed by their own custom_<slug> table). */
export async function listCustomObjects(db: Db, orgId: string): Promise<CustomObjectInfo[]> {
  const rows = await db
    .select({
      slug: schema.objectConfig.slug,
      singular: schema.objectConfig.singularName,
      plural: schema.objectConfig.pluralName,
      tableName: schema.objectConfig.tableName,
      isActive: schema.objectConfig.isActive,
    })
    .from(schema.objectConfig)
    .where(or(eq(schema.objectConfig.organizationId, orgId), isNull(schema.objectConfig.organizationId)));
  return rows
    .filter((r) => r.isActive !== false && typeof r.tableName === "string" && r.tableName.startsWith("custom_"))
    .map((r) => ({
      slug: r.slug,
      singular: r.singular ?? r.slug,
      plural: r.plural ?? r.slug,
      tableName: r.tableName as string,
    }));
}

export interface CustomFieldInfo {
  name: string;
  label: string;
  fieldType: string;
  options: unknown;
}

/**
 * Field defs for a custom object. The codebase stores `custom_field_defs.resource`
 * inconsistently — the object-create flow uses the table name (`custom_<slug>`)
 * while the add-field modal uses the slug — so match either.
 */
export async function listCustomFieldDefs(
  db: Db,
  orgId: string,
  slug: string,
  tableName: string,
): Promise<CustomFieldInfo[]> {
  const rows = await db
    .select({
      name: schema.customFieldDefs.name,
      label: schema.customFieldDefs.label,
      fieldType: schema.customFieldDefs.fieldType,
      options: schema.customFieldDefs.options,
    })
    .from(schema.customFieldDefs)
    .where(
      and(
        or(eq(schema.customFieldDefs.resource, slug), eq(schema.customFieldDefs.resource, tableName)),
        or(eq(schema.customFieldDefs.organizationId, orgId), isNull(schema.customFieldDefs.organizationId)),
      ),
    );
  return rows.map((r) => ({
    name: r.name,
    label: r.label ?? r.name,
    fieldType: r.fieldType ?? "text",
    options: r.options,
  }));
}

function customRowsOf(result: unknown): Record<string, unknown>[] {
  return (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as Record<
    string,
    unknown
  >[];
}

/** Free-text search over a custom object's table (matches name + any custom field value). */
export async function searchCustomRecords(
  db: Db,
  orgId: string,
  tableName: string,
  query: string,
  limit = SEARCH_LIMIT,
): Promise<Record<string, unknown>[]> {
  const table = sql.identifier(tableName);
  const q = (query ?? "").trim();
  if (!q) {
    const r = await db.execute(
      sql`SELECT * FROM ${table} WHERE organization_id = ${orgId} ORDER BY created_at DESC LIMIT ${limit}`,
    );
    return customRowsOf(r);
  }
  const like = `%${q}%`;
  const r = await db.execute(
    sql`SELECT * FROM ${table} WHERE organization_id = ${orgId} AND (name ILIKE ${like} OR custom_fields::text ILIKE ${like}) ORDER BY created_at DESC LIMIT ${limit}`,
  );
  return customRowsOf(r);
}
