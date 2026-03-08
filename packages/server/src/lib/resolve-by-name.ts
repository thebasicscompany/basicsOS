/**
 * Shared hybrid CRM record search and resolution helpers.
 *
 * Search uses fuzzy text matching first (pg_trgm), then blends in semantic
 * ranking from existing record embeddings when gateway search context is
 * available.
 */

import {
  and,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { writeUsageLogSafe } from "@/lib/usage-log.js";

export interface HybridSearchContext {
  gatewayUrl?: string;
  gatewayHeaders?: Record<string, string>;
  crmUserId?: number;
}

type MatchRow = { id: number; matchScore: number };

export interface ContactMatch extends MatchRow {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  companyId: number | null;
}

export interface CompanyMatch extends MatchRow {
  name: string;
  category: string | null;
  domain: string | null;
  description: string | null;
}

export interface DealMatch extends MatchRow {
  name: string;
  status: string;
  amount: number | null;
  companyId: number | null;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeForComparison(value: string): string {
  return normalizeWhitespace(value.toLowerCase().replace(/[^\w@.]+/g, " "));
}

function uniqueTerms(terms: string[]): string[] {
  const unique = new Map<string, string>();
  for (const term of terms) {
    const normalized = normalizeWhitespace(term);
    if (!normalized) continue;
    const key = normalizeForComparison(normalized);
    if (!key || unique.has(key)) continue;
    unique.set(key, normalized);
  }
  return [...unique.values()];
}

function expandBasicSearchTerms(query: string): string[] {
  const base = normalizeWhitespace(query);
  if (!base) return [];

  const variants = [base];
  const punctuationLight = normalizeWhitespace(base.replace(/[_/\\-]+/g, " "));
  if (punctuationLight && punctuationLight !== base) variants.push(punctuationLight);
  if (base.includes("&")) variants.push(normalizeWhitespace(base.replace(/&/g, " and ")));
  if (/\band\b/i.test(base)) variants.push(normalizeWhitespace(base.replace(/\band\b/gi, "&")));

  return uniqueTerms(variants);
}

const MAX_COMPANY_NAME_VARIANTS = 12;

export function expandCompanyNameTerms(name: string): string[] {
  const variants = new Map<string, string>();
  const pending = [...expandBasicSearchTerms(name)];

  while (pending.length > 0) {
    if (variants.size >= MAX_COMPANY_NAME_VARIANTS) break;

    const current = normalizeWhitespace(pending.pop() ?? "");
    if (!current) continue;

    const key = normalizeForComparison(current);
    if (!key || variants.has(key)) continue;
    variants.set(key, current);

    const withMr = normalizeWhitespace(current.replace(/\bmister\b/gi, "mr"));
    if (withMr && normalizeForComparison(withMr) !== key) {
      pending.push(withMr, normalizeWhitespace(withMr.replace(/\bmr\b/gi, "mr.")));
    }

    const withMister = normalizeWhitespace(current.replace(/\bmr\.?\b/gi, "mister"));
    if (withMister && normalizeForComparison(withMister) !== key) {
      pending.push(withMister);
    }

    const withCo = normalizeWhitespace(current.replace(/\bcompany\b/gi, "co"));
    if (withCo && normalizeForComparison(withCo) !== key) {
      pending.push(withCo, normalizeWhitespace(withCo.replace(/\bco\b/gi, "co.")));
    }

    const withCompany = normalizeWhitespace(current.replace(/\bco\.?\b/gi, "company"));
    if (withCompany && normalizeForComparison(withCompany) !== key) {
      pending.push(withCompany);
    }
  }

  return [...variants.values()];
}

function greatestSimilarity(
  value: SQL<unknown> | SQLWrapper,
  terms: string[],
): SQL<number> {
  if (terms.length === 0) return sql<number>`0`;

  const parts = terms.map((term) =>
    sql`similarity(lower(coalesce(${value}, '')), lower(${term}))`
  );
  return parts.length === 1
    ? sql<number>`${parts[0]}`
    : sql<number>`greatest(${sql.join(parts, sql`, `)})`;
}

function includesNormalized(values: Array<string | null | undefined>, query: string): boolean {
  const normalizedQuery = normalizeForComparison(query);
  if (!normalizedQuery) return false;
  return values.some((value) => normalizeForComparison(value ?? "").includes(normalizedQuery));
}

function equalsNormalized(values: Array<string | null | undefined>, query: string): boolean {
  const normalizedQuery = normalizeForComparison(query);
  if (!normalizedQuery) return false;
  return values.some((value) => normalizeForComparison(value ?? "") === normalizedQuery);
}

async function embedQuery(
  gatewayUrl: string,
  gatewayHeaders: Record<string, string>,
  query: string,
): Promise<{ embedding: number[] | null; inputTokens: number }> {
  try {
    const response = await fetch(`${gatewayUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...gatewayHeaders,
      },
      body: JSON.stringify({ model: "basics-embed", input: query }),
    });
    if (!response.ok) {
      await response.text().catch(() => {});
      return { embedding: null, inputTokens: 0 };
    }

    const json = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      usage?: { prompt_tokens?: number; total_tokens?: number };
    };
    const fromApi = json.usage?.prompt_tokens ?? json.usage?.total_tokens ?? 0;
    return {
      embedding: json.data?.[0]?.embedding ?? null,
      inputTokens: fromApi > 0 ? fromApi : Math.max(1, Math.ceil(query.length / 4)),
    };
  } catch {
    return { embedding: null, inputTokens: 0 };
  }
}

async function getEmbeddingScores(
  db: Db,
  organizationId: string,
  entityType: "contact" | "company" | "deal",
  query: string,
  searchContext?: HybridSearchContext,
  limit = 8,
): Promise<Map<number, number>> {
  if (!query.trim()) return new Map();
  if (!searchContext?.gatewayUrl || !searchContext.gatewayHeaders) return new Map();

  const { embedding, inputTokens } = await embedQuery(
    searchContext.gatewayUrl,
    searchContext.gatewayHeaders,
    query,
  );
  if (!embedding) return new Map();

  if (searchContext.crmUserId != null) {
    writeUsageLogSafe(db, {
      organizationId,
      crmUserId: searchContext.crmUserId,
      feature: "embedding_record_search",
      model: "basics-embed",
      inputTokens,
    });
  }

  const embeddingStr = `[${embedding.join(",")}]`;
  const result = await db.execute(sql`
    SELECT entity_id, 1 - (embedding <=> ${embeddingStr}::vector) AS vector_score
    FROM context_embeddings
    WHERE organization_id = ${organizationId}
      AND entity_type = ${entityType}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  const rows = (
    Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Array<{ entity_id: number | string; vector_score: number | string | null }>;

  const scores = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.entity_id);
    const score = Number(row.vector_score ?? 0);
    if (Number.isFinite(id) && Number.isFinite(score)) {
      scores.set(id, Math.max(0, score));
    }
  }
  return scores;
}

async function applyEmbeddingScores<T extends MatchRow>(
  rows: T[],
  embeddingScores: Map<number, number>,
  fetchMissing: (ids: number[]) => Promise<T[]>,
): Promise<T[]> {
  if (embeddingScores.size === 0) {
    return [...rows].sort((a, b) => b.matchScore - a.matchScore);
  }

  const byId = new Map<number, T>();
  for (const row of rows) {
    const vectorScore = embeddingScores.get(row.id) ?? 0;
    byId.set(row.id, { ...row, matchScore: row.matchScore + vectorScore * 0.35 });
  }

  const missingIds = [...embeddingScores.keys()].filter((id) => !byId.has(id));
  if (missingIds.length > 0) {
    const missingRows = await fetchMissing(missingIds);
    for (const row of missingRows) {
      const vectorScore = embeddingScores.get(row.id) ?? 0;
      byId.set(row.id, { ...row, matchScore: row.matchScore + vectorScore * 0.35 });
    }
  }

  return [...byId.values()].sort((a, b) => b.matchScore - a.matchScore);
}

export async function searchContactsByQuery(
  db: Db,
  organizationId: string,
  query: string,
  searchContext?: HybridSearchContext,
  limit = 10,
): Promise<ContactMatch[]> {
  const q = query.trim();
  if (!q) {
    const rows = await db
      .select({
        id: schema.contacts.id,
        firstName: schema.contacts.firstName,
        lastName: schema.contacts.lastName,
        email: schema.contacts.email,
        companyId: schema.contacts.companyId,
      })
      .from(schema.contacts)
      .where(eq(schema.contacts.organizationId, organizationId))
      .orderBy(sql`${schema.contacts.id} desc`)
      .limit(limit);

    return rows.map((row) => ({ ...row, matchScore: 0 }));
  }

  const terms = expandBasicSearchTerms(q);
  const nameExpr = sql<string>`concat_ws(' ', coalesce(${schema.contacts.firstName}, ''), coalesce(${schema.contacts.lastName}, ''))`;
  const nameSimilarity = greatestSimilarity(nameExpr, terms);
  const emailSimilarity = greatestSimilarity(schema.contacts.email, terms);
  const textClauses = [
    ...terms.map((term) => ilike(schema.contacts.firstName, `%${term}%`)),
    ...terms.map((term) => ilike(schema.contacts.lastName, `%${term}%`)),
    ...terms.map((term) => ilike(schema.contacts.email, `%${term}%`)),
    sql`${nameSimilarity} >= 0.18`,
    sql`${emailSimilarity} >= 0.22`,
  ];

  const [textRows, embeddingScores] = await Promise.all([
    db
      .select({
        id: schema.contacts.id,
        firstName: schema.contacts.firstName,
        lastName: schema.contacts.lastName,
        email: schema.contacts.email,
        companyId: schema.contacts.companyId,
        nameSimilarity,
        emailSimilarity,
      })
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.organizationId, organizationId),
          or(...textClauses)!,
        ),
      )
      .limit(Math.max(limit * 2, 12)),
    getEmbeddingScores(db, organizationId, "contact", q, searchContext),
  ]);

  const ranked = textRows.map((row) => {
    const fullName = [row.firstName, row.lastName].filter(Boolean).join(" ");
    const exactBonus = equalsNormalized([fullName, row.email], q) ? 1.5 : 0;
    const containsBonus = includesNormalized([fullName, row.email], q) ? 0.4 : 0;
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      companyId: row.companyId,
      matchScore:
        Number(row.nameSimilarity ?? 0) * 1.35
        + Number(row.emailSimilarity ?? 0) * 1.15
        + exactBonus
        + containsBonus,
    };
  });

  const merged = await applyEmbeddingScores(
    ranked,
    embeddingScores,
    async (ids) => {
      const rows = await db
        .select({
          id: schema.contacts.id,
          firstName: schema.contacts.firstName,
          lastName: schema.contacts.lastName,
          email: schema.contacts.email,
          companyId: schema.contacts.companyId,
        })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.organizationId, organizationId),
            inArray(schema.contacts.id, ids),
          ),
        );
      return rows.map((row) => ({ ...row, matchScore: 0 }));
    },
  );

  return merged.slice(0, limit);
}

export async function searchCompaniesByQuery(
  db: Db,
  organizationId: string,
  query: string,
  searchContext?: HybridSearchContext,
  limit = 10,
): Promise<CompanyMatch[]> {
  const q = query.trim();
  if (!q) {
    const rows = await db
      .select({
        id: schema.companies.id,
        name: schema.companies.name,
        category: schema.companies.category,
        domain: schema.companies.domain,
        description: schema.companies.description,
      })
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, organizationId))
      .orderBy(sql`${schema.companies.id} desc`)
      .limit(limit);

    return rows.map((row) => ({ ...row, matchScore: 0 }));
  }

  const nameTerms = expandCompanyNameTerms(q);
  const metaTerms = expandBasicSearchTerms(q);
  const metaExpr = sql<string>`concat_ws(' ', coalesce(${schema.companies.category}, ''), coalesce(${schema.companies.domain}, ''), coalesce(${schema.companies.description}, ''))`;
  const nameSimilarity = greatestSimilarity(schema.companies.name, nameTerms);
  const metaSimilarity = greatestSimilarity(metaExpr, metaTerms);
  const textClauses = [
    ...nameTerms.map((term) => ilike(schema.companies.name, `%${term}%`)),
    ...metaTerms.map((term) => ilike(schema.companies.category, `%${term}%`)),
    ...metaTerms.map((term) => ilike(schema.companies.domain, `%${term}%`)),
    ...metaTerms.map((term) => ilike(schema.companies.description, `%${term}%`)),
    sql`${nameSimilarity} >= 0.16`,
    sql`${metaSimilarity} >= 0.12`,
  ];

  const [textRows, embeddingScores] = await Promise.all([
    db
      .select({
        id: schema.companies.id,
        name: schema.companies.name,
        category: schema.companies.category,
        domain: schema.companies.domain,
        description: schema.companies.description,
        nameSimilarity,
        metaSimilarity,
      })
      .from(schema.companies)
      .where(
        and(
          eq(schema.companies.organizationId, organizationId),
          or(...textClauses)!,
        ),
      )
      .limit(Math.max(limit * 2, 12)),
    getEmbeddingScores(db, organizationId, "company", q, searchContext),
  ]);

  const ranked = textRows.map((row) => {
    const exactBonus = equalsNormalized([row.name, row.domain], q) ? 1.6 : 0;
    const containsBonus = includesNormalized(
      [row.name, row.domain, row.category, row.description],
      q,
    )
      ? 0.45
      : 0;
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      domain: row.domain,
      description: row.description,
      matchScore:
        Number(row.nameSimilarity ?? 0) * 1.6
        + Number(row.metaSimilarity ?? 0) * 0.7
        + exactBonus
        + containsBonus,
    };
  });

  const merged = await applyEmbeddingScores(
    ranked,
    embeddingScores,
    async (ids) => {
      const rows = await db
        .select({
          id: schema.companies.id,
          name: schema.companies.name,
          category: schema.companies.category,
          domain: schema.companies.domain,
          description: schema.companies.description,
        })
        .from(schema.companies)
        .where(
          and(
            eq(schema.companies.organizationId, organizationId),
            inArray(schema.companies.id, ids),
          ),
        );
      return rows.map((row) => ({ ...row, matchScore: 0 }));
    },
  );

  return merged.slice(0, limit);
}

export async function searchDealsByQuery(
  db: Db,
  organizationId: string,
  query: string,
  searchContext?: HybridSearchContext,
  limit = 10,
): Promise<DealMatch[]> {
  const q = query.trim();
  if (!q) {
    const rows = await db
      .select({
        id: schema.deals.id,
        name: schema.deals.name,
        status: schema.deals.status,
        amount: schema.deals.amount,
        companyId: schema.deals.companyId,
      })
      .from(schema.deals)
      .where(
        and(
          eq(schema.deals.organizationId, organizationId),
          isNull(schema.deals.archivedAt),
        ),
      )
      .orderBy(sql`${schema.deals.id} desc`)
      .limit(limit);

    return rows.map((row) => ({ ...row, matchScore: 0 }));
  }

  const terms = expandBasicSearchTerms(q);
  const nameSimilarity = greatestSimilarity(schema.deals.name, terms);
  const statusSimilarity = greatestSimilarity(schema.deals.status, terms);
  const textClauses = [
    ...terms.map((term) => ilike(schema.deals.name, `%${term}%`)),
    ...terms.map((term) => ilike(schema.deals.status, `%${term}%`)),
    sql`${nameSimilarity} >= 0.16`,
    sql`${statusSimilarity} >= 0.2`,
  ];

  const [textRows, embeddingScores] = await Promise.all([
    db
      .select({
        id: schema.deals.id,
        name: schema.deals.name,
        status: schema.deals.status,
        amount: schema.deals.amount,
        companyId: schema.deals.companyId,
        nameSimilarity,
        statusSimilarity,
      })
      .from(schema.deals)
      .where(
        and(
          eq(schema.deals.organizationId, organizationId),
          isNull(schema.deals.archivedAt),
          or(...textClauses)!,
        ),
      )
      .limit(Math.max(limit * 2, 12)),
    getEmbeddingScores(db, organizationId, "deal", q, searchContext),
  ]);

  const ranked = textRows.map((row) => {
    const exactBonus = equalsNormalized([row.name, row.status], q) ? 1.3 : 0;
    const containsBonus = includesNormalized([row.name, row.status], q) ? 0.35 : 0;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      amount: row.amount,
      companyId: row.companyId,
      matchScore:
        Number(row.nameSimilarity ?? 0) * 1.5
        + Number(row.statusSimilarity ?? 0) * 0.6
        + exactBonus
        + containsBonus,
    };
  });

  const merged = await applyEmbeddingScores(
    ranked,
    embeddingScores,
    async (ids) => {
      const rows = await db
        .select({
          id: schema.deals.id,
          name: schema.deals.name,
          status: schema.deals.status,
          amount: schema.deals.amount,
          companyId: schema.deals.companyId,
        })
        .from(schema.deals)
        .where(
          and(
            eq(schema.deals.organizationId, organizationId),
            isNull(schema.deals.archivedAt),
            inArray(schema.deals.id, ids),
          ),
        );
      return rows.map((row) => ({ ...row, matchScore: 0 }));
    },
  );

  return merged.slice(0, limit);
}

const RESOLUTION_MIN_SCORE = 0.18;

export async function resolveContactByName(
  db: Db,
  organizationId: string,
  name: string,
  searchContext?: HybridSearchContext,
): Promise<number | null> {
  const [row] = await searchContactsByQuery(db, organizationId, name, searchContext, 1);
  return row && row.matchScore >= RESOLUTION_MIN_SCORE ? row.id : null;
}

export async function resolveDealByName(
  db: Db,
  organizationId: string,
  name: string,
  searchContext?: HybridSearchContext,
): Promise<number | null> {
  const [row] = await searchDealsByQuery(db, organizationId, name, searchContext, 1);
  return row && row.matchScore >= RESOLUTION_MIN_SCORE ? row.id : null;
}

export async function resolveCompanyByName(
  db: Db,
  organizationId: string,
  name: string,
  searchContext?: HybridSearchContext,
): Promise<number | null> {
  const [row] = await searchCompaniesByQuery(db, organizationId, name, searchContext, 1);
  return row && row.matchScore >= RESOLUTION_MIN_SCORE ? row.id : null;
}
